# Talk: Measuring the Overhead of Trust Mechanisms in X-Road

---

## 1. Cover (0:20)

Hello, I'm Ruslan. I'm measuring what X-Road's trust mechanisms cost per message. I'll go through the question, the earlier work, my setup, and some first, preliminary numbers.

## 2. What X-Road is (1:00)

First, what X-Road is. It's the data exchange layer Estonia has used since the early 2000s for public services, and it's also used in Finland and other countries.

Organisations don't call each other's systems directly. Each one runs a Security Server in front of its information system, and every message goes from one Security Server to another: signed, logged on both sides, and over mutual TLS, that is Transport Layer Security where both servers present a certificate. That's the orange arrow.

Above them, the Central Server tells everyone who the members are and which services to trust: the certificate authority, the OCSP responder, OCSP being the Online Certificate Status Protocol, which says whether a certificate is still valid, and the time-stamping service. These are dashed on the slide, because they work in the background, not on every message. That difference, every message versus background, is the thread of this talk.

## 3. Research question (1:00)

All of these mechanisms make the exchange trustworthy: signing and verification, logging, time stamps, mutual TLS. My question: what does each of them cost, in milliseconds and bytes, and which cost is paid on every request rather than deferred?

Why now: proposals like post-quantum signatures or a decentralised PKI, a public key infrastructure, would make this trust layer more expensive. X-Road performance has been measured before, but only end to end or on a single machine, and not broken down by mechanism, while NIIS, the Nordic Institute for Interoperability Solutions that maintains X-Road, publishes no open performance data. So there is no baseline you could compare those proposals against. I look at three things: the cost per mechanism, how it changes with size and load, and whether one machine or separate machines changes the answer.

## 4. The measured request path (1:10)

A load generator plays the client. The consumer's Security Server signs and logs the request and sends it over mutual TLS to the provider's Security Server, which verifies, logs, and passes it to an echo service. The response goes back the same way.

Paid on every request: signing, verification and logging, on both sides. And, which I found from the traffic: by default every message also opens a new TLS connection with a full handshake.

Deferred: time stamps are taken in batches, about two calls per thousand messages in my runs, and certificate status comes from a cache refreshed every twenty minutes. So OCSP has no per-request cost to measure.

## 5. What the closest X-Road studies measured (0:50)

The existing work answers different questions. Ansper and colleagues designed the signing and batching but didn't measure it. Mironova documented production settings. Taklai measured the total latency through the Security Server, but not where it comes from. Snetkov gives post-quantum signature sizes without timing. Bakhtina measured on a single laptop.

So there are measurements, but none of them gives a cost per mechanism and per message, under reported conditions and on separate machines, and NIIS publishes no performance data of its own that could fill that gap.

## 6. Broader work used for the method (0:35)

Two works outside X-Road. Naylor and colleagues show that TLS has two costs, connection setup and per-request work, which is the split I use. Georges and colleagues: Java timings need warm-up and repeated runs, and you report the spread with every number.

## 7. Configurations actually run (1:00)

Signing can't be switched off, so every result is a difference against the default, "full".

Direct is plain HTTP straight to the echo service, with no X-Road, so its difference to full is the whole X-Road path. Nobody stops logging message bodies. Synctsa time-stamps every message synchronously; that's a different policy, not the cost of time-stamping. Reuse keeps connections open, so the difference is the handshake. And a second provider shows what limits the consumer under load.

I dropped two: delaying time stamps broke a documented constraint, and short OCSP freshness made every request fail.

## 8. Metrics and procedure (0:45)

Latency percentiles and throughput, always with the spread between runs and the number of successful requests. Bytes only on the link between the two servers.

Ten kilobytes and one megabyte with one client, ten kilobytes under load. Five repetitions in random order, a control run each time, and I wait for the batched time stamps before cleaning the logs, so that deferred work isn't lost.

## 9. Testbed (0:50)

Three laptops on their own switch. One runs the central services and the test certificate authority, one the consumer and the load generator, one the provider. Containers have their own addresses, so there's no address translation in the path, and traffic between the laptops stays inside the switch.

The same stand also runs on a single laptop. Same hardware, so the only difference is the network.

## 10. Preliminary results, one client (1:20)

Fifteen runs per point. A plain HTTP call without X-Road takes under a millisecond. Through X-Road, 28 milliseconds at 10 kilobytes and 74 at one megabyte, with about one and a half percent variation between runs.

Not logging bodies changes nothing at 10 kilobytes but saves almost half at one megabyte. The synchronous time stamp adds almost 90 milliseconds per request.

Every request succeeded. It's preliminary because of the old laptops and a local test PKI, which make these numbers optimistic.

The same grid on one of these laptops alone, with the same CPU, gives practically the same picture: 30 milliseconds instead of 28, and each mechanism's cost within one to three milliseconds. So for a single client on a local network, the network doesn't change the result. Under load it's different: three machines handle about one and a half times more requests per second, because the work is spread over three CPUs, not because of the network.

## 11. Connection setup vs per-message work (0:45)

With connection reuse, latency drops by 2 milliseconds and traffic by 3.3 kilobytes per message. That's the handshake. So the handshake is paid every time, but it's small. The other 26 milliseconds are signing, verification and logging, which is where bigger post-quantum signatures would show up.

## 12. Limitations found so far (0:50)

The big surprise: the power mode of the processor, the CPU. The same run took 80 milliseconds in the balanced profile and 29 in performance mode. It looked like network overhead until X-Road's own per-step timestamps showed that pure computation slowed down too. Now it's fixed and recorded with every run.

Under load the results vary too much to separate configurations, so there I'll only report throughput ceilings. And it's a test PKI on three old laptops, with no wide-area link.

## 13. Status and next steps (0:30)

Done: the testbed, clean results on three machines, and the comparison with one machine. Running now: the same grid on my own laptop. Next: the final tables in the report by the end of the week.

Two open questions for you. First, a plain mutual TLS baseline without X-Road, two simple proxies with the same certificates. Connection reuse already shows that the handshake is about 2 of the 28 milliseconds, so I'd add it only if you think the cost of the TLS channel itself is worth isolating. Second, do the three laptops cover the final measurements, or would you still like a run on virtual machines from the university's HPC centre?

Thank you, I'm happy to take questions.

---

## What can come off the slides once this is said

The talk carries the explanations. The slides only need the anchor for each point.

- **2. What X-Road is:** the diagram is the slide; everything else is said aloud.
- **3. Research question:** keep the question; RQ1–RQ3 as three short labels ("per mechanism", "size and load", "environment").
- **4. Request path:** keep the diagram. The two boxes shrink to keywords: "sign · verify · log · TLS handshake" and "batched time stamps · cached OCSP".
- **5. Prior studies:** keep the table, 2–4 words per cell. The gap sentence is said aloud.
- **6. Broader work:** title, authors and one "Used for: …" line per work.
- **7. Configurations:** names and "what changes". The third column and the "Dropped" line are said aloud.
- **8. Metrics and procedure:** one line for the grid and the metric names.
- **9. Testbed:** keep the diagram; the bullets below are said aloud.
- **10. Results:** keep the table; the footnote becomes one line ("15 runs per point · all requests succeeded · preliminary").
- **11. TLS:** keep the three numbers; drop the sentence underneath.
- **12. Limitations:** headline plus one number each (for example "CPU power mode: 80 → 29 ms").
- **13. Status:** three short lines.
