import type { Metadata } from "next";
import Link from "next/link";
import { LegalCallout, LegalList, LegalPage, LegalSection } from "@/components/legal";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Nearby Bids connects buyers with nearby shops. The sale itself is between you and the shop — here is what that means in practice.",
};

/*
 * Scoped to what exists today (AUC-79). Three things are deliberately NOT on
 * this page:
 *
 *  - Any commission rate, cap or fee schedule. GST / e-commerce-operator
 *    classification is unresolved (AUC-74) and a published fee schedule is the
 *    exact fact pattern that question turns on.
 *  - Any self-classification under the e-commerce rules. We state what the
 *    product does and let that speak; asserting a legal conclusion before a CA
 *    has looked at it would become evidence of our own claimed position.
 *  - Any promise of buyer protection, refunds, arbitration or a resolution
 *    deadline. Complaint handling moves no money, and support inherits
 *    whatever this page claims.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="29 August 2026"
      intro={
        <>
          Nearby Bids is a way to find shops near you and get prices from them. The sale itself is between you and the
          shop. That one sentence explains most of what follows.
        </>
      }
    >
      <LegalSection heading="What we do, and what we do not do">
        <p>
          We put a request in front of shops near you and show you what they come back with. We are not the seller. We
          do not stock, own, inspect, handle, or deliver anything you buy.
        </p>
        <LegalCallout>
          When you accept a bid, you are agreeing to buy from that shop. The purchase, the payment and the goods are
          between the two of you. You pay the shop directly, in person — money for goods never passes through us.
        </LegalCallout>
      </LegalSection>

      <LegalSection heading="Bids are offers from shops, not prices from us">
        <p>
          Every price you see was set by a shop, not by us. We do not check it, set it, cap it, or promise it is the
          lowest available anywhere. A bid is that shop offering to sell you something at that price.
        </p>
        <p>
          We also cannot promise how many bids you will get, or how quickly. That depends on how many shops near you
          sell what you are asking for. Some requests will get several bids; some may get none.
        </p>
        <p>
          A shop should honour a bid it has made. If it does not, tell us — see below — but be clear that the
          agreement to sell is theirs, not ours.
        </p>
      </LegalSection>

      <LegalSection heading="Confirming a deal">
        <p>
          When you pick a bid, you get a QR code. The shop scans it when you are there. That is what marks the deal as
          done — neither side can confirm a deal remotely by clicking a button, which is deliberate: it means a
          completed deal reflects someone actually turning up.
        </p>
        <p>Do not share your QR code with anyone other than the shop you chose.</p>
      </LegalSection>

      <LegalSection heading="If something goes wrong">
        <p>Here is honestly what we can and cannot do, because this is where platforms tend to overpromise.</p>
        <LegalList
          items={[
            <>
              <strong>What we do:</strong> we record complaints about a deal, look into them, and take them into
              account when deciding whether a shop stays on the platform. A shop with a pattern of not honouring bids
              can lose its verified status or be removed.
            </>,
            <>
              <strong>What we do not do:</strong> we do not hold your money, so we cannot refund it. We do not decide
              who is right in a dispute over goods, we do not offer buyer protection or a guarantee, and we cannot
              compel a shop to do anything beyond removing it from the platform.
            </>,
          ]}
        />
        <p>
          For a problem with the goods themselves — faulty, not as described, warranty — your rights are against the
          shop that sold to you, in the same way they would be for any other in-person purchase. Your legal rights as
          a consumer are not affected by anything on this page.
        </p>
      </LegalSection>

      <LegalSection heading="What it costs">
        <p>
          <strong>If you are buying:</strong> nothing. Customers are not charged to post a request, to receive bids,
          or to accept one.
        </p>
        <p>
          <strong>If you run a shop:</strong> nothing during the pilot. There is no listing fee, no charge to bid, and
          currently no mechanism by which we could take payment from a shop at all.
        </p>
        <p>
          We do intend to charge shops eventually — a share of a sale won through the platform, never a subscription
          and never a fee per lead. We are not publishing a rate here, because we have not settled on one and we would
          rather say that than print a number we have to take back. No shop will be charged anything without being
          told the rate first, in advance.
        </p>
      </LegalSection>

      <LegalSection heading="Using the service properly">
        <LegalList
          items={[
            "Post real requests for things you actually intend to buy.",
            "If you run a shop, bid prices you can honour, for goods you can legally sell.",
            "Do not use the service to harvest contact details, to advertise, or to send anyone marketing.",
            "Do not attempt to see other shops' bids, interfere with the bidding, or misuse another person's QR code.",
          ]}
        />
        <p>
          We can suspend or remove an account that does any of these, or that we have good reason to think is acting
          in bad faith.
        </p>
      </LegalSection>

      <LegalSection heading="The service as it is today">
        <p>
          This is a pilot. Features will change, things will occasionally break, and we may change or stop parts of
          the service. We provide it as it is, and we cannot promise it will always be available or error-free.
        </p>
        <p>
          Because we are not party to the sale, we are not responsible for the goods, the conduct of a shop or a
          customer, or a deal that does not happen. Nothing here limits any liability that cannot legally be limited.
        </p>
      </LegalSection>

      <LegalSection heading="Reaching us">
        <p>
          For anything — a complaint about a deal, a question about these terms, or a problem with your account — call{" "}
          <a
            className="font-medium text-ink-800 underline underline-offset-2 hover:text-brand-700"
            href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}
          >
            {CONTACT_PHONE}
          </a>{" "}
          or email{" "}
          <a
            className="font-medium text-ink-800 underline underline-offset-2 hover:text-brand-700"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          These terms are governed by Indian law. We will update this page as the product changes, and we will say so
          when a change actually affects you.
        </p>
        <p className="text-sm text-ink-500">
          See also our{" "}
          <Link className="underline underline-offset-2 hover:text-ink-900" href="/privacy">
            Privacy
          </Link>{" "}
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
