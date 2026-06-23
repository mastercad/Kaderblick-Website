# Internal billing deployment notes

This file is for deployment maintainers, not end users.

1. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the deployment environment.
2. Enable recurring PayPal, SEPA Direct Debit, cards, Apple Pay and Google Pay in the Stripe dashboard as available.
3. Enable the Stripe customer portal with invoice history, payment-method updates and cancellation.
4. Register `https://<host>/api/billing/webhook/stripe` for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
5. Run Doctrine migrations and rebuild the API image so `app:billing:process` is installed in cron.
6. Verify checkout, invoices, webhook signatures, failed-payment notifications and trial pause/resume in Stripe test mode before enabling live billing.
