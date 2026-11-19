package pqbench;

import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.Security;
import java.security.Signature;
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

/**
 * SignBench for SLH-DSA "small" parameter sets, whose signing takes about a second: 1 s iterations would hold
 * one operation, so iterations are 5 s and there are fewer forks. Only plausible in the CA/OCSP role.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 10, time = 5)
@Fork(3)
public class SlowSignBench {

    @Param({"SLH-DSA-SHA2-128S-BC", "SLH-DSA-SHA2-256S-BC"})
    public String alg;

    @Param({"1024"})
    public int input;

    private Signature signer;
    private Signature verifier;
    private byte[] data;
    private byte[] signature;

    @Setup(Level.Trial)
    public void setup() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        SignBench.Algo a = SignBench.Algo.of(alg);
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
}
