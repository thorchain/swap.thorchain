# DNS-AID Records

DNS for AI Discovery requires DNS changes outside this repository.

Suggested records for the zone owner to review:

```dns
_index._agents.swap.thorchain.org. 3600 IN HTTPS 1 swap.thorchain.org. alpn="h2" port=443 mandatory=alpn,port
_a2a._agents.swap.thorchain.org. 3600 IN HTTPS 1 swap.thorchain.org. alpn="h2" port=443 mandatory=alpn,port
```

The public discovery zone should be DNSSEC signed before this scanner item can pass reliably.
