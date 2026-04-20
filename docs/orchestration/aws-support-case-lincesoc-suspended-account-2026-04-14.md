# AWS Support Case Draft

Date: 2026-04-14

## Current Status

- Case opened manually in the AWS Support Center
- Case ID: `177618647600516`
- Created: `2026-04-14T17:07:56.188Z`
- Opened by: `lincesoc@gmail.com`
- Category: `Account, Account Reinstatement`
- Severity: `General question`
- Status at opening: `Unassigned`

## Why this was not opened automatically

An automated attempt to use the AWS Support API from the management account
`582381607124` failed with:

`SubscriptionRequiredException: Amazon Web Services Premium Support Subscription is required to use this service.`

That means this account cannot open support cases through the Support API/CLI.
The case must be submitted manually in the AWS Support Center console.

## Console Path

- AWS Console
- Support Center
- Create case
- Case type: `Account and billing support`
- Category: `Account`
- If available, choose: `Suspended Account Recovery`

## Suggested Subject

`Reactivate suspended member account 706922781464 and unblock account creation in organization o-72819a60ow`

## Suggested Severity

`Production system impaired`

## Suggested Body

```text
Hello AWS Support,

We need help reactivating a suspended AWS Organizations member account and
unblocking account creation in our organization.

Management account:
- Account ID: 582381607124
- Account name: lince

Affected suspended member account:
- Account ID: 706922781464
- Account name: lince-prd

Organization:
- Org ID: o-72819a60ow

Current situation:
- The member account 706922781464 (lince-prd) is currently SUSPENDED.
- This suspension is blocking our migration and preventing us from creating the
  next environment account (lince-hml) through AWS Organizations.
- The same fraud-detection block also appears to be affecting Route 53 domain
  registration for lincesoc.cloud.

What we need from AWS:
1. Reactivate member account 706922781464 (lince-prd).
2. Unblock new account creation in organization o-72819a60ow so we can create
   the hml account.
3. Confirm whether any verification or billing information is still required
   from our side to clear the fraud-detection hold.
4. If related, confirm whether the same block is affecting Route 53 domain
   registration and what is needed to clear it.

Operational impact:
- Production migration is blocked.
- Security baseline rollout through Organizations cannot proceed.
- Environment creation for hml is blocked.

Primary operator / billing owner:
- João Lucas Lima Freire
- lincesoc@gmail.com
- lucaslima4132@gmail.com

Please let us know exactly which verification steps or documents are required to
restore the account and clear the organization-level restriction.

Thank you.
```

## Attach / Mention If Asked

- Screenshot or export showing member account `706922781464` as `SUSPENDED`
- Confirmation that management account `582381607124` is active
- Date observed in AWS Organizations: `2026-04-14`
