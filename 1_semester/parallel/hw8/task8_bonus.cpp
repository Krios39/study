#include <openvino/openvino.hpp>
#include <openvino/op/matmul.hpp>
#include <openvino/op/parameter.hpp>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <random>
#include <string>
#include <vector>

static double now_s()
{
    return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

static double median(std::vector<double> v)
{
    std::sort(v.begin(), v.end());
    size_t n = v.size();
    return n % 2 ? v[n / 2] : 0.5 * (v[n / 2 - 1] + v[n / 2]);
}

int main(int argc, char** argv)
{
    const size_t N = argc > 1 ? std::stoul(argv[1]) : 2048;
    const int runs = argc > 2 ? std::atoi(argv[2]) : 5;

    ov::Core core;
    std::printf("OpenVINO %s\n", ov::get_openvino_version().buildNumber);
    std::vector<std::string> devices = core.get_available_devices();
    std::printf("Available devices:\n");
    for (const auto& d : devices) {
        std::string name = core.get_property(d, ov::device::full_name);
        std::printf("  %-6s %s\n", d.c_str(), name.c_str());
    }
    std::printf("\n");

    auto a = std::make_shared<ov::op::v0::Parameter>(ov::element::f32, ov::Shape{N, N});
    auto b = std::make_shared<ov::op::v0::Parameter>(ov::element::f32, ov::Shape{N, N});
    auto mm = std::make_shared<ov::op::v0::MatMul>(a, b, false, false);
    auto model = std::make_shared<ov::Model>(ov::OutputVector{mm}, ov::ParameterVector{a, b}, "matmul");

    ov::Tensor tA(ov::element::f32, ov::Shape{N, N}), tB(ov::element::f32, ov::Shape{N, N});
    std::mt19937 gen(1);
    std::uniform_real_distribution<float> dist(0.0f, 1.0f);
    for (size_t i = 0; i < N * N; i++) tA.data<float>()[i] = dist(gen);
    for (size_t i = 0; i < N * N; i++) tB.data<float>()[i] = dist(gen);

    std::vector<float> reference;
    const double gflop = 2.0 * N * N * N * 1e-9;

    for (const std::string label : {"CPU", "GPU", "GPU_f32", "NPU"}) {
        const std::string target = label.substr(0, 3);
        if (std::find(devices.begin(), devices.end(), target) == devices.end()) {
            std::printf("%s: not available on this machine\n", label.c_str());
            continue;
        }
        try {
            double t0 = now_s();
            ov::AnyMap config;
            if (label == "GPU_f32") config[ov::hint::inference_precision.name()] = ov::element::f32;
            ov::CompiledModel compiled = core.compile_model(model, target, config);
            double compile = now_s() - t0;
            std::string precision = "default";
            try {
                precision = compiled.get_property(ov::hint::inference_precision).get_type_name();
            } catch (...) {
            }
            ov::InferRequest req = compiled.create_infer_request();
            req.set_input_tensor(0, tA);
            req.set_input_tensor(1, tB);
            req.infer();

            std::vector<double> t;
            for (int r = 0; r < runs; r++) {
                double s = now_s();
                req.infer();
                t.push_back(now_s() - s);
            }
            const ov::Tensor out = req.get_output_tensor();
            const float* c = out.data<const float>();

            std::string check;
            if (reference.empty()) {
                reference.assign(c, c + N * N);
                check = "reference";
            } else {
                double maxRef = 0, maxDiff = 0;
                for (size_t i = 0; i < N * N; i++) {
                    maxRef = std::max(maxRef, static_cast<double>(std::fabs(reference[i])));
                    maxDiff = std::max(maxDiff, static_cast<double>(std::fabs(c[i] - reference[i])));
                }
                char buf[64];
                std::snprintf(buf, sizeof(buf), "max rel. error vs CPU %.2e", maxDiff / maxRef);
                check = buf;
            }
            std::printf("%s  N=%zu  compile %.3f s  infer median %.4f s (min %.4f, max %.4f, %d runs)  %.1f GFLOP/s  "
                        "precision %s  %s\n",
                        label.c_str(), N, compile, median(t), *std::min_element(t.begin(), t.end()),
                        *std::max_element(t.begin(), t.end()), runs, gflop / median(t), precision.c_str(),
                        check.c_str());
        } catch (const std::exception& e) {
            std::printf("%s: failed: %s\n", label.c_str(), e.what());
        }
    }
    return 0;
}
