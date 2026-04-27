import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Size Guide | Cheap Shot Hockey",
};

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-testid="size-guide-page">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-xs text-[color:var(--muted)]"
        data-testid="size-guide-breadcrumbs"
      >
        <Link href="/" className="hover:text-[color:var(--foreground)]">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[color:var(--foreground)]">Size Guide</span>
      </nav>

      <h1 className="mb-2 font-black text-3xl" data-testid="size-guide-heading">
        Size Guide
      </h1>
      <p className="mb-8 text-sm text-[color:var(--muted)]">
        Not sure what size to order? Use the charts below. When in doubt, size
        up — most hockey gear is designed to be worn over base layers.
      </p>

      {/* Sticks */}
      <section className="mb-10" data-testid="size-guide-sticks">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Sticks
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <p>
            Stick length is measured from the heel of the blade to the top of
            the shaft. Stand in skates and hold the stick upright — the butt
            end should reach between your chin and nose.
          </p>
          <table className="w-full border-collapse text-xs" data-testid="sticks-size-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 pr-4 font-semibold">Player height</th>
                <th className="py-2 pr-4 font-semibold">Age (approx.)</th>
                <th className="py-2 font-semibold">Typical flex</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[color:var(--border)]" data-testid="sticks-row-youth">
                <td className="py-2 pr-4 text-[color:var(--foreground)]">Youth</td>
                <td className="py-2 pr-4">Under 4&apos;4&quot;</td>
                <td className="py-2 pr-4">Under 8</td>
                <td className="py-2">40–50</td>
              </tr>
              <tr className="border-b border-[color:var(--border)]" data-testid="sticks-row-junior">
                <td className="py-2 pr-4 text-[color:var(--foreground)]">Junior</td>
                <td className="py-2 pr-4">4&apos;4&quot; – 5&apos;1&quot;</td>
                <td className="py-2 pr-4">7–12</td>
                <td className="py-2">50–60</td>
              </tr>
              <tr className="border-b border-[color:var(--border)]" data-testid="sticks-row-intermediate">
                <td className="py-2 pr-4 text-[color:var(--foreground)]">Intermediate</td>
                <td className="py-2 pr-4">5&apos;2&quot; – 5&apos;8&quot;</td>
                <td className="py-2 pr-4">11–14</td>
                <td className="py-2">65–75</td>
              </tr>
              <tr data-testid="sticks-row-senior">
                <td className="py-2 pr-4 text-[color:var(--foreground)]">Senior</td>
                <td className="py-2 pr-4">5&apos;8&quot; and up</td>
                <td className="py-2 pr-4">14+</td>
                <td className="py-2">77–102</td>
              </tr>
            </tbody>
          </table>
          <p>
            <span className="font-semibold text-[color:var(--foreground)]">Flex tip:</span>{" "}
            A good starting flex is roughly half your body weight in pounds. Lighter
            players and defensemen typically prefer softer flex; heavy shooters
            go stiffer.
          </p>
        </div>
      </section>

      {/* Skates */}
      <section className="mb-10" data-testid="size-guide-skates">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Skates
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <p>
            Hockey skate sizing runs 1 to 1.5 sizes smaller than your street
            shoe. Measure your foot length in centimeters for the most accurate
            fit.
          </p>
          <table className="w-full border-collapse text-xs" data-testid="skates-size-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">US shoe size</th>
                <th className="py-2 pr-4 font-semibold">Foot length (cm)</th>
                <th className="py-2 font-semibold">Skate size (approx.)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["6", "23.5", "4.5 – 5"],
                ["7", "24.5", "5.5 – 6"],
                ["8", "25.5", "6.5 – 7"],
                ["9", "26.5", "7.5 – 8"],
                ["10", "27.5", "8.5 – 9"],
                ["11", "28.5", "9.5 – 10"],
                ["12", "29.5", "10.5 – 11"],
              ].map(([shoe, cm, skate]) => (
                <tr
                  key={shoe}
                  className="border-b border-[color:var(--border)]"
                  data-testid={`skates-row-${shoe}`}
                >
                  <td className="py-2 pr-4">{shoe}</td>
                  <td className="py-2 pr-4">{cm}</td>
                  <td className="py-2 text-[color:var(--foreground)]">{skate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <span className="font-semibold text-[color:var(--foreground)]">Fit tip:</span>{" "}
            Your toes should lightly brush the toe cap when standing straight.
            When you bend your knees into a skating stance they should clear by
            about a quarter inch.
          </p>
        </div>
      </section>

      {/* Helmets */}
      <section className="mb-10" data-testid="size-guide-helmets">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Helmets &amp; Cages
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <p>
            Measure your head circumference with a soft tape, about one inch
            above your eyebrows.
          </p>
          <table className="w-full border-collapse text-xs" data-testid="helmets-size-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">Size</th>
                <th className="py-2 font-semibold">Head circumference</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["S", '20.5" – 21.5" (52–55 cm)'],
                ["M", '21.5" – 22.5" (55–57 cm)'],
                ["L", '22.5" – 23.5" (57–60 cm)'],
                ["XL", '23.5" – 24.5" (60–62 cm)'],
              ].map(([size, range]) => (
                <tr
                  key={size}
                  className="border-b border-[color:var(--border)]"
                  data-testid={`helmets-row-${size.toLowerCase()}`}
                >
                  <td className="py-2 pr-4 text-[color:var(--foreground)] font-semibold">{size}</td>
                  <td className="py-2">{range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gloves */}
      <section className="mb-10" data-testid="size-guide-gloves">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Gloves
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <p>
            Glove size is measured in inches from the base of your palm to the
            tip of your middle finger, then rounded up to the nearest inch.
          </p>
          <table className="w-full border-collapse text-xs" data-testid="gloves-size-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">Glove size</th>
                <th className="py-2 pr-4 font-semibold">Hand length</th>
                <th className="py-2 font-semibold">Recommended for</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["9 in", '4.5" – 5"', "Small youth"],
                ["10 in", '5" – 5.5"', "Youth / small junior"],
                ["11 in", '5.5" – 6"', "Junior"],
                ["12 in", '6" – 6.5"', "Large junior / small senior"],
                ["13 in", '6.5" – 7"', "Senior (average)"],
                ["14 in", '7" – 7.5"', "Senior (large)"],
                ["15 in", '7.5"+',"Senior (XL)"],
              ].map(([size, hand, rec]) => (
                <tr
                  key={size}
                  className="border-b border-[color:var(--border)]"
                  data-testid={`gloves-row-${size.replace(" ", "")}`}
                >
                  <td className="py-2 pr-4 text-[color:var(--foreground)] font-semibold">{size}</td>
                  <td className="py-2 pr-4">{hand}</td>
                  <td className="py-2">{rec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Jerseys */}
      <section className="mb-10" data-testid="size-guide-jerseys">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Jerseys
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <p>
            Hockey jerseys are cut loose to fit over shoulder pads. If you wear
            a medium in street clothes, size down to small for an athletic fit
            or stay at medium for the traditional baggy look.
          </p>
          <table className="w-full border-collapse text-xs" data-testid="jerseys-size-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">Size</th>
                <th className="py-2 pr-4 font-semibold">Chest</th>
                <th className="py-2 font-semibold">Height</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["S", '36" – 40"', '5\'6" – 5\'9"'],
                ["M", '40" – 44"', '5\'9" – 6\'0"'],
                ["L", '44" – 48"', '6\'0" – 6\'2"'],
                ["XL", '48" – 52"', '6\'2" – 6\'4"'],
                ["XXL", '52"+',"6'4\"+"],
              ].map(([size, chest, height]) => (
                <tr
                  key={size}
                  className="border-b border-[color:var(--border)]"
                  data-testid={`jerseys-row-${size.toLowerCase()}`}
                >
                  <td className="py-2 pr-4 text-[color:var(--foreground)] font-semibold">{size}</td>
                  <td className="py-2 pr-4">{chest}</td>
                  <td className="py-2">{height}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Goalie gear */}
      <section className="mb-10" data-testid="size-guide-goalie">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Goalie Gear
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="goalie-leg-pads">
            <p className="font-semibold text-[color:var(--foreground)]">Leg pads</p>
            <p className="mt-1">
              Leg pad sizing uses a two-number format like <strong className="text-[color:var(--foreground)]">34+1</strong> — the first
              number is the pad&apos;s knee-to-toe length in inches; the +1 is the
              boot extension. Measure from the center of your kneecap to the
              ankle bone, then add 1–2 inches for proper coverage.
            </p>
          </div>
          <table className="w-full border-collapse text-xs" data-testid="goalie-leg-pads-table">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-semibold">Goalie height</th>
                <th className="py-2 font-semibold">Recommended pad size</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Under 5\'4\"", "28+1 – 31+1"],
                ["5\'4\" – 5\'8\"", "31+1 – 33+1"],
                ["5\'8\" – 6\'0\"", "33+1 – 35+1"],
                ["6\'0\" – 6\'4\"", "35+1 – 37+1"],
                ["6\'4\" and up", "37+1 – 39+1"],
              ].map(([height, pad]) => (
                <tr
                  key={height}
                  className="border-b border-[color:var(--border)]"
                  data-testid={`goalie-row-${height.replace(/[^a-z0-9]/gi, "")}`}
                >
                  <td className="py-2 pr-4">{height}</td>
                  <td className="py-2 text-[color:var(--foreground)]">{pad}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div data-testid="goalie-chest-protector">
            <p className="font-semibold text-[color:var(--foreground)]">Chest protector</p>
            <p className="mt-1">
              Chest protectors use standard S / M / L / XL sizing based on
              chest circumference (same as the jersey chart above). Size up if
              you prefer more coverage.
            </p>
          </div>
        </div>
      </section>

      {/* Help */}
      <section data-testid="size-guide-help">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Still not sure?
        </h2>
        <p className="text-sm text-[color:var(--muted)]">
          Our pro shop team is happy to help you pick the right fit. Reach us at{" "}
          <a
            href="mailto:support@cheapshot.test"
            className="text-[color:var(--accent)] hover:opacity-80"
            data-testid="size-guide-contact-email"
          >
            support@cheapshot.test
          </a>
          . You can also check our{" "}
          <Link href="/shipping" className="text-[color:var(--accent)] hover:opacity-80">
            return policy
          </Link>{" "}
          — we offer free returns on unworn gear within 30 days.
        </p>
      </section>
    </div>
  );
}
