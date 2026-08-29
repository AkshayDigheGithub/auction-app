import type { Metadata } from "next";
import Link from "next/link";
import { LegalCallout, LegalList, LegalPage, LegalSection } from "@/components/legal";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Nearby Bids collects, why, and who can see it. We do not sell your phone number and we do not send marketing messages.",
};

/*
 * Every claim on this page is one the code actually enforces today. Where a
 * protection is scoped, the scope is stated rather than rounded up — notably
 * "shops do not see your number while bidding", which is true, as opposed to
 * "shops never see your number", which is not: it is shared once a deal is
 * locked, and again to the other side if a complaint is raised.
 *
 * Deliberately absent, because neither is built: a deletion SLA and a data
 * retention period. There is no delete/anonymise endpoint and no cleanup job,
 * so a number here would be a promise nobody could keep.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="29 August 2026"
      intro={
        <>
          The shortest version: we ask for a phone number so you can log in and so a deal can actually happen. We do
          not sell it, we do not rent it, and we do not send marketing messages to it.
        </>
      }
    >
      <LegalSection heading="If you are a shop owner, read this bit first">
        <p>
          The usual worry about a platform like this is that it is a lead-generation scheme that will sell your number
          on and bury you in sales calls. That is worth answering plainly rather than burying in a policy.
        </p>
        <LegalCallout>
          We do not sell, rent, or share your phone number with advertisers, data brokers, or other businesses. The
          only messages we send you are a login code and alerts about activity near you. There is no marketing SMS or
          WhatsApp list, and no code in our system that could send one.
        </LegalCallout>
      </LegalSection>

      <LegalSection heading="What we collect">
        <p>Only what the product needs to work:</p>
        <LegalList
          items={[
            <>
              <strong>Your phone number.</strong> This is how you log in — we send a one-time code to it. It is also
              how we reach you about a deal.
            </>,
            <>
              <strong>The area you are shopping in.</strong> Either a place you type in or your device location, if
              you allow it. We need it to work out which shops are near enough to be useful.
            </>,
            <>
              <strong>What you ask for.</strong> The product you post and any description you add.
            </>,
            <>
              <strong>If you run a shop:</strong> your shop name, its address and map location, and what you sell. A
              shop is a public-facing business, so this is shown to customers who get a bid from you.
            </>,
          ]}
        />
        <p>
          We do not ask for your name to get started, we do not ask for identity documents, and we never ask for card
          or bank details — there is nothing on this platform to pay us for.
        </p>
      </LegalSection>

      <LegalSection heading="Who can see your phone number">
        <p>This is the part worth being exact about, so here is the actual sequence.</p>
        <LegalList
          items={[
            <>
              <strong>While shops are bidding, they cannot see it.</strong> A shop sees the product you asked for,
              your rough area and how far away you are. Not your number, not your name.
            </>,
            <>
              <strong>Once you choose a bid, the shop you chose can see it.</strong> You are about to walk into their
              shop and collect something — they need to be able to reach you if anything changes. Shops you did not
              choose never get it.
            </>,
            <>
              <strong>If a complaint is raised about a deal,</strong> the people involved in that deal and our team
              can see the contact details for that deal while it is reviewed.
            </>,
          ]}
        />
        <p>
          Shops also cannot see each other. A shop bidding on your request cannot see any other shop&apos;s price, and
          you only ever see a shop&apos;s name and whether it has been checked by us — never its account details.
        </p>
      </LegalSection>

      <LegalSection heading="What we use it for">
        <LegalList
          items={[
            "Sending you a code to log in.",
            "Matching a request to shops that are close enough to serve it.",
            "Telling a shop owner that somebody nearby is asking for something they sell.",
            "Letting the two sides complete a deal in person.",
            "Looking into complaints, and deciding whether a shop should stay on the platform.",
          ]}
        />
        <p>
          That is the whole list. We do not build advertising profiles and we do not pass your activity to third
          parties for their own marketing.
        </p>
      </LegalSection>

      <LegalSection heading="Services we rely on">
        <p>
          We use outside services to actually run the product — to send the SMS with your login code, to host the
          service, and to show maps and work out distances. They handle your information only to do that job for us,
          not for their own purposes. We do not sell data to anyone, and we have no advertising trackers on the app.
        </p>
      </LegalSection>

      <LegalSection heading="Keeping and deleting your information">
        <p>
          We keep your account and its history while your account is open. Records of completed deals and of any
          complaint are kept even after that, because both sides may need to refer back to what happened.
        </p>
        <p>
          If you want your account or your data removed, call or email us and we will do it. We are being deliberately
          plain here: this is handled by a person, not by a button in the app, so we are not going to quote you a
          turnaround we have not built the means to guarantee.
        </p>
      </LegalSection>

      <LegalSection heading="Changes, and how to reach us">
        <p>
          We are running a pilot, and this page will change as the product does. If we change something that affects
          what happens to your number, we will say so rather than quietly editing this page.
        </p>
        <p>
          Questions, or want your data removed? Call{" "}
          <a className="font-medium text-ink-800 underline underline-offset-2 hover:text-brand-700" href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
            {CONTACT_PHONE}
          </a>{" "}
          or email{" "}
          <a className="font-medium text-ink-800 underline underline-offset-2 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . A person answers both.
        </p>
        <p className="text-sm text-ink-500">
          See also our <Link className="underline underline-offset-2 hover:text-ink-900" href="/terms">Terms</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
