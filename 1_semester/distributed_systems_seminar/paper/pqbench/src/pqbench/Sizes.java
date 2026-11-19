package pqbench;

import java.security.KeyPair;
import java.security.Security;
import java.security.Signature;

import org.bouncycastle.jce.provider.BouncyCastleProvider;

/** Encoded public key and signature sizes, in bytes, as CSV; signature length over n signatures (ECDSA and Falcon vary). */
public class Sizes {

    public static void main(String[] args) throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        System.out.println("alg,public_key_bytes,signature_bytes_min,signature_bytes_avg,signature_bytes_max,n");
        for (String s : new String[] {
                "RSA-2048-SHA512-BC", "RSA-3072-SHA512-BC", "RSA-4096-SHA512-BC",
                "ECDSA-P256-SHA512-BC", "ECDSA-P384-SHA512-BC",
                "ML-DSA-44-BC", "ML-DSA-65-BC", "ML-DSA-87-BC",
                "FALCON-512-BC", "FALCON-1024-BC",
                "SLH-DSA-SHA2-128S-BC", "SLH-DSA-SHA2-128F-BC", "SLH-DSA-SHA2-256S-BC",
                "MLDSA44-RSA2048-PSS-SHA256-BC", "MLDSA44-ECDSA-P256-SHA256-BC",
                "MLDSA65-RSA3072-PSS-SHA512-BC", "MLDSA65-ECDSA-P256-SHA512-BC",
                "MLDSA87-RSA4096-PSS-SHA512-BC", "MLDSA87-ECDSA-P384-SHA512-BC"}) {
            SignBench.Algo a = SignBench.Algo.of(s);
            KeyPair kp = a.keyPair();
            Signature sig = a.signature();
            sig.initSign(kp.getPrivate());
            int n = s.startsWith("SLH-DSA") ? 2 : 100;           // SLH-DSA signatures have a fixed length
            int min = Integer.MAX_VALUE, max = 0;
            long sum = 0;
            byte[] data = new byte[1024];
            for (int i = 0; i < n; i++) {
                data[0] = (byte) i;
                sig.update(data);
                int len = sig.sign().length;
                min = Math.min(min, len);
                max = Math.max(max, len);
                sum += len;
            }
            System.out.println(s + "," + kp.getPublic().getEncoded().length + "," + min + ","
                + String.format(java.util.Locale.ROOT, "%.1f", (double) sum / n) + "," + max + "," + n);
        }
    }
}
