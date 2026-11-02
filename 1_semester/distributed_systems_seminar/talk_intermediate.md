# Talk: Measuring the Overhead of Trust Mechanisms in X-Road

---

## 1. Cover (0:15)

Hello, I'm Ruslan. At the last presentation I showed the plan and preliminary numbers. Today I'll show the final results, and on each slide I'll say what changed since then.

## 2. What X-Road is (1:25)

I'll start with X-Road in a bit more detail. It's the data exchange layer Estonia has used for public services since the early 2000s, and it's also used in other countries.

Organisations don't call each other's systems directly. Each runs a Security Server in front of its information system, and a call goes through both Security Servers.

The Security Servers do the trust work. The sender signs the message with its own key, and the receiver verifies that signature. Both log the message, as evidence of the exchange. Between them runs mutual TLS, where both servers present a certificate. That's the orange arrow.

At the top, the Central Server distributes the global configuration: who the members are and which trust services to accept. The certificate authority issues the certificates, the OCSP responder says whether a certificate is still valid, and the time-stamping service proves when a logged message existed.

These are dashed, because they work in the background, not on every message: status answers are cached and time stamps are batched. That difference, every message versus background, runs through the whole talk.

## 3. Research question (0:35)

The question is what these mechanisms cost per message, and which of that cost is paid on every message.

The wording now matches what was measured. RQ1 says "as far as they can be separated", because signing can't be switched off. RQ2 is response size and throughput. RQ3 now also includes a round-trip time added between the Security Servers.

## 4. The measured request path (0:35)

A load generator plays the client, and the two Security Servers sign, verify and log on the way to an echo service and back.

One correction: I used to call the per-message cost a TLS handshake. What the captures show is a new TCP connection for every message, and a TLS session resumed from a ticket.

## 5. Related work (0:25)

The closest X-Road work gives the design, production settings, total latency, post-quantum sizes, and a measurement on one laptop, but no cost per mechanism. NIIS publishes no open performance data, so that's the gap.

Two works give the method. Naylor: the cost of TLS depends on how connections are used. Georges: warm-up, independent runs and a reported spread.

## 6. Configurations actually run (0:40)

Signing can't be switched off, so every result is a difference against the default, full.

Direct against full is the whole X-Road path, nobody tests logging of bodies, and synctsa is a different time-stamping policy.

The main correction is reuse. It shows the effect of the connection policy, including TCP setup, the resumed TLS session and the TCP state. It doesn't isolate the handshake. So I dropped the plain mutual TLS baseline and narrowed the claim.

## 7. Metrics and procedure (0:20)

The procedure is the same as last time. Two things are new: the stage breakdown from operational monitoring, with one millisecond resolution, and the added round-trip time. And sizes are always response sizes.

## 8. Testbed and environments (0:30)

The main environment is still three identical laptops on one switch. The same stack also runs on one of them alone, and now on a newer laptop, which shows how the numbers depend on the CPU.

On the three machines I add a controlled round-trip time with netem. It's emulation, not a wide-area deployment.

## 9. Cost with one client, RQ1 (0:45)

These are final numbers now: 30, 15 and 20 repetitions instead of 15.

On three machines the whole X-Road path adds about 28 milliseconds at 10 kilobytes and 64 at one megabyte. Not logging bodies changes nothing beyond the spread at 10 kilobytes, but saves 47 percent at one megabyte. Reuse saves 2 and 4 milliseconds. Synchronous time-stamping adds about 90.

The spread between repetitions is under 5 percent on three machines. One machine gives the same picture. Every request succeeded. And certificate status and batched time stamps don't appear in the request path.

## 10. Per-stage breakdown (0:45)

Last time I said the remaining 26 milliseconds were signing, verification and logging. I can't claim that, so here is what the stages show.

Each configuration changes the stages where its mechanism works. Reuse shortens the way to the provider. Not logging a one megabyte body saves about 17 milliseconds on each side. Synchronous time-stamping adds 20 to 25 in each of the four stages that log a record.

The stages containing signing or verification take 4 to 11 milliseconds. That bounds their cost, but it doesn't measure those operations alone.

## 11. Connection policy on the local network (0:25)

On the local network the connection policy costs about 2 milliseconds and 6.2 kilobytes per exchange: 3.3 towards the provider, 2.9 back. Last time I gave only one direction.

That's small, and it isn't just the handshake. It becomes important with distance, as we'll see in a moment.

## 12. Size and load, RQ2 (0:40)

Size first: most of the growth up to one megabyte is writing the body to the log.

Under load there's now a ceiling for each configuration, with the number of clients and the spread in brackets. The first four columns differ by less than the spread, so I don't assign those differences to mechanisms. Synchronous time-stamping is clearly lower: 37 to 47 percent of the full ceiling.

## 13. Added round-trip time, RQ3 (0:45)

This part is new.

The slope is how fast latency grows with the added round-trip time, so it's the number of round trips a message waits for. From the handshakes I predicted 3 for full and 1 for reuse. I measured 5.1 and 2.1 at 10 kilobytes, and at one megabyte 10.7 and 2.

So at 50 milliseconds, reusing connections saves 54 percent at 10 kilobytes and 72 percent at one megabyte. Among the configurations I compared, this is the largest effect.

## 14. Why more round trips: TCP (0:50)

The captures explain the gap. At 10 kilobytes, the end of the request waits for an acknowledgement, and on a new connection the response needs a second flight. That gives 5 and 2.

At one megabyte, a new connection starts with a small window that doubles each round trip: about six flights, as in the chart. With reuse the window is kept between messages.

In review it was pointed out that netem on the sender can distort TCP. So I repeated this with the delay at the receiver: same flights, same slopes. A control with the same rules and zero delay changed nothing at 10 kilobytes and added 3 to 4 milliseconds at one megabyte. The 10.7 varies between nights by about one round trip. And this holds for this emulation, with no cross traffic and no losses.

## 15. Limitations (0:20)

The power mode is settled: all results are in performance mode. Under load the spread limits what I can say. The trust services run next to the Security Servers, which is optimistic, and these are laptops. So I read the results as differences, not absolute values.

## 16. Conclusions (0:35)

So: the X-Road path costs about 28 milliseconds, logging decides the growth with size, and with distance the connection policy has the largest effect among the configurations compared.

This gives a baseline for post-quantum signatures, a decentralised PKI and threshold signatures. Larger messages could cost extra round trips with a new connection per message, but only if they no longer fit the same flights, and I didn't measure that.

Thank you, I'm happy to take questions.
