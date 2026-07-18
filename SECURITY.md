# Security policy

## Supported versions

clink-fe tracks the latest commit on `main`; fixes are not backported.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting on this repository (Security tab, "Report a
vulnerability"), or email orhaugh@gmail.com with details and a reproduction.
You will get an acknowledgement within a few days.

## Scope and deployment notes

clink-fe is a static single-page app; it ships no server of its own. It is a
client for a clink coordinator's HTTP API and holds no credentials - it renders
whatever that API returns.

- Serve the built assets over HTTPS and only expose the console to trusted
  operators; it is a control surface for a cluster (it can submit and cancel
  jobs through the coordinator).
- The clink coordinator's HTTP API is the real trust boundary - secure it
  (`CLINK_AUTH_TOKEN`, TLS) as described in clink's own SECURITY.md. The
  console inherits whatever access that endpoint grants.
- Treat the SQL workbench and job-submission views as privileged: submitting a
  job runs code on the cluster.
