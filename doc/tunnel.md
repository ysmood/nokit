## Tunnel

`not` is a tcp/udp tunnel tool. For example if you want to ssh a machine behind a firewall,
you can use it to easily reverse proxy port 22 to the outside world.

For more help, run: `not -h`.

> The data is encrypted on the client, so the server can't sniff the data passed between clients,
> it acts as a router.
> Now only the tcp packet will be encrypted, upd will sent as raw data.

### Quick Start

```text
                                      r.com
      +-----------+  export port  +-----------+  connect port  +-----------+
      | Machine A +-------------->| Machine R |<---------------+ Machine B |
      +-----------+               +-----------+                +-----------+
 not -o r.com -x 8080 -n A            not -s                 not -o r.com -t A
```

Suppose A and B cannot reach each other via network directly.
But they both have tcp access to the R (`r.com`).

0. Start the relay server on R to proxy tcp/udp: `not -s`,

0. Start a proxy client on A to connect to R and export self as A: `not -o r.com -n A`

0. Start a proxy client on B to connect to R and forward tcp/udp to A: `not -o r.com -t A`

That's all you need. Now your packet to B's port 7000, will be transparently forward
to A's port 8080 through the R.

IF you want to change the default port, run `not -h` for more options.
