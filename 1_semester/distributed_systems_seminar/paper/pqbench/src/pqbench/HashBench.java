package pqbench;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.Security;
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

/** Digest of a message body; the same for every signature scheme. */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 10, time = 1)
@Fork(5)
public class HashBench {

    @Param({"SHA-256", "SHA-512"})
    public String digest;

    @Param({"BC", "JDK"})
    public String provider;

    @Param({"10240", "1048576"})
    public int size;

    private MessageDigest md;
    private byte[] data;

    @Setup(Level.Trial)
    public void setup() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        md = provider.equals("JDK") ? MessageDigest.getInstance(digest) : MessageDigest.getInstance(digest, "BC");
        data = new byte[size];
        new SecureRandom().nextBytes(data);
    }

    @Benchmark
    public byte[] hash() {
        return md.digest(data);
    }
}
