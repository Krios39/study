package pqbench;

import java.security.KeyPair;
import java.security.MessageDigest;
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
 * Pure versus pre-hash variants (HashML-DSA, HashSLH-DSA, composite PREHASH) in one run, same settings as
 * SignBench. X-Road's signer receives a digest, so a migration would need the pre-hash variants or a changed
 * interface; this measures whether the variant changes the time.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 10, time = 1)
@Fork(5)
public class PrehashBench {

    @Param({
        "ML-DSA-44-BC", "ML-DSA-44-WITH-SHA512-BC",
        "ML-DSA-65-BC", "ML-DSA-65-WITH-SHA512-BC",
        "ML-DSA-87-BC", "ML-DSA-87-WITH-SHA512-BC",
        "SLH-DSA-SHA2-128F-BC", "SLH-DSA-SHA2-128F-WITH-SHA256-BC",
        "MLDSA44-RSA2048-PSS-SHA256-BC", "MLDSA44-RSA2048-PSS-SHA256-PREHASH-BC",
        "MLDSA65-ECDSA-P256-SHA512-BC", "MLDSA65-ECDSA-P256-SHA512-PREHASH-BC",
        "MLDSA87-ECDSA-P384-SHA512-BC", "MLDSA87-ECDSA-P384-SHA512-PREHASH-BC"})
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
        if (alg.contains("-PREHASH")) {
            // BC's composite PREHASH signs a digest computed by the caller, as X-Road's signer receives one
            data = MessageDigest.getInstance(alg.contains("SHA256") ? "SHA-256" : "SHA-512").digest(data);
        }
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
