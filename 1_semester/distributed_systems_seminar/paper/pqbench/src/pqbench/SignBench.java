package pqbench;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Security;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.concurrent.TimeUnit;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Level;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Warmup;

/** Signing and verification of a small input, as X-Road signs the digests of a message, not the message. */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 10, time = 1)
@Fork(5)
public class SignBench {

    /** name: algorithm-parameter-digest-provider */
    @Param({
        "RSA-2048-SHA256-BC", "RSA-2048-SHA512-BC", "RSA-3072-SHA512-BC", "RSA-4096-SHA512-BC", "RSA-2048-SHA512-JDK",
        "ECDSA-P256-SHA256-BC", "ECDSA-P256-SHA512-BC", "ECDSA-P384-SHA512-BC",
        "ML-DSA-44-BC", "ML-DSA-65-BC", "ML-DSA-87-BC",
        "FALCON-512-BC", "FALCON-1024-BC",
        "SLH-DSA-SHA2-128F-BC",
        "MLDSA44-RSA2048-PSS-SHA256-BC", "MLDSA44-ECDSA-P256-SHA256-BC",
        "MLDSA65-RSA3072-PSS-SHA512-BC", "MLDSA65-ECDSA-P256-SHA512-BC",
        "MLDSA87-RSA4096-PSS-SHA512-BC", "MLDSA87-ECDSA-P384-SHA512-BC"})
    public String alg;

    /** bytes signed; about the size of a SignedInfo with the digests of a message */
    @Param({"1024"})
    public int input;

    private Signature signer;
    private Signature verifier;
    private byte[] data;
    private byte[] signature;

    @Setup(Level.Trial)
    public void setup() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        Algo a = Algo.of(alg);
        KeyPair kp = a.keyPair();
        data = new byte[input];
        new SecureRandom().nextBytes(data);
        signer = a.signature();
        signer.initSign(kp.getPrivate());
        verifier = a.signature();
        verifier.initVerify(kp.getPublic());
        signature = sign();
        if (!verify()) {
            throw new IllegalStateException("verification failed for " + alg);
        }
    }

    @Benchmark
    public byte[] sign() throws Exception {
        signer.update(data);
        return signer.sign();
    }

    @Benchmark
    public boolean verify() throws Exception {
        verifier.update(data);
        return verifier.verify(signature);
    }

    /** Key generation and signature objects for a benchmark name. */
    record Algo(String name, String keyAlg, Object keyParam, String sigAlg, String provider) {

        static Algo of(String s) {
            String p = s.endsWith("-JDK") ? null : "BC";
            if (s.startsWith("RSA-")) {
                String[] f = s.split("-");
                return new Algo(s, "RSA", Integer.parseInt(f[1]), f[2] + "withRSA", p);
            }
            if (s.startsWith("ECDSA-P")) {
                String[] f = s.split("-");                       // ECDSA-P256-SHA512-BC
                String curve = "secp" + f[1].substring(1) + "r1";
                return new Algo(s, "EC", new ECGenParameterSpec(curve), f[2] + "withECDSA", p);
            }
            String n = s.substring(0, s.lastIndexOf('-'));      // name without the provider suffix
            if (s.startsWith("ML-DSA-") || s.startsWith("FALCON-")) {
                return new Algo(s, n, null, n, p);
            }
            if (s.startsWith("SLH-DSA-")) {                      // FIPS 205: pure, or HashSLH-DSA for "...-WITH-SHAxxx"
                return new Algo(s, n, null, n.contains("-WITH-") ? n : "SLH-DSA", p);
            }
            if (s.startsWith("MLDSA")) {                         // composite ML-DSA, RFC 10073 (BC 1.84: pre-RFC draft)
                return new Algo(s, n.replace("-PREHASH", ""), null, n, p);   // pre-hash variant uses the same keys
            }
            throw new IllegalArgumentException(s);
        }

        KeyPair keyPair() throws Exception {
            KeyPairGenerator g = provider == null
                ? KeyPairGenerator.getInstance(keyAlg) : KeyPairGenerator.getInstance(keyAlg, provider);
            if (keyParam instanceof Integer bits) {
                g.initialize(bits);
            } else if (keyParam instanceof ECGenParameterSpec spec) {
                g.initialize(spec);
            }
            return g.generateKeyPair();
        }

        Signature signature() throws Exception {
            return provider == null ? Signature.getInstance(sigAlg) : Signature.getInstance(sigAlg, provider);
        }
    }
}
