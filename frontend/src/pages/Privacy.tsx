import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const Privacy: React.FC = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Privacy Policy | RealVision AI';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">RealVision AI Privacy Policy</h1>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Effective date: {new Date().toLocaleDateString()}
          </p>
        </header>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">1. Who we are</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            RealVision AI (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) delivers AI-powered imagery services purpose-built for
            real estate professionals, interior designers, photographers, and developers. Our platform includes image enhancement,
            virtual staging, element replacement, furnishing, and exterior design transformations (collectively, the &ldquo;Services&rdquo;).
            We only collect the minimum information required to operate these Services reliably and securely.
          </p>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">2. Information we collect</h2>
          <div className="mt-4 space-y-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Account information</h3>
              <p>
                We request a single data point for account creation and authentication: your work email address. We use passwordless
                codes delivered to that address to grant access to the platform. We do not collect names, phone numbers, passwords,
                or payment details during sign up.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Project inputs</h3>
              <p>
                When you upload images or project briefs to use the Services, we process that content to generate the requested
                AI transformations. Uploaded assets and generated results are stored securely to power features such as interactive
                sliders, version history, and team collaboration. You remain the owner of all images you upload.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Usage analytics</h3>
              <p>
                We may collect limited technical details (browser type, device, approximate location, and in-app clicks) to improve
                performance, detect abuse, and prioritize feature enhancements. This information is aggregated and does not identify
                individual users.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">3. How we use your information</h2>
          <ul className="mt-4 list-disc space-y-3 pl-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <li>Authenticating you with passwordless email codes and maintaining your workspace session.</li>
            <li>Processing uploaded imagery to deliver enhancements, staging, replacements, furnishing, and exterior renders.</li>
            <li>Providing collaboration tools, audit trails, and approval workflows for your team.</li>
            <li>Sending essential product notifications, such as deliverability updates and feature releases.</li>
            <li>Monitoring platform health, security incidents, and abuse patterns to protect the Services.</li>
          </ul>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">4. Sharing and third parties</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            We never sell your email address, project data, or generated outputs. We may share limited information with vendors
            who help us deliver the Services, each bound by contractual obligations to protect your data:
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <li>Cloud infrastructure providers that host our application and render workloads.</li>
            <li>Authentication partners that deliver secure one-time codes via email.</li>
            <li>Analytics tools that help us monitor reliability and improve usability.</li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            We may disclose information if required by law, regulation, legal process, or governmental request, or to protect the
            rights, property, or safety of RealVision AI, our users, or the public.
          </p>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">5. Data retention</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            We retain your email address and workspace assets for as long as your account remains active or as needed to provide
            the Services. You can request deletion of your projects or entire account at any time by contacting us. Generated
            outputs may be stored longer to support audit requirements, QA, or compliance obligations agreed upon in enterprise
            contracts.
          </p>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">6. Security</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            We implement administrative, technical, and physical safeguards designed to protect your information. These measures
            include access controls, encryption in transit and at rest, environment isolation, and human-in-the-loop quality checks.
            While no system is perfectly secure, we continuously monitor and improve our defenses to meet the expectations of
            professional real estate and design teams.
          </p>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">7. Your rights and choices</h2>
          <ul className="mt-4 list-disc space-y-3 pl-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <li>
              <span className="font-semibold text-slate-900 dark:text-white">Access and updates:</span> You may view or update your
              email address by contacting our support team.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-white">Project deletion:</span> Delete individual projects from within
              the platform or request full workspace removal by emailing us.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-white">Opt-out of communications:</span> Essential account notices
              will continue, but you can unsubscribe from promotional updates at any time.
            </li>
          </ul>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">8. Children&rsquo;s privacy</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            The Services are intended for professional use. We do not knowingly collect personal information from anyone under the
            age of 18. If you believe a minor has provided us with personal information, please contact us and we will take steps to
            remove it.
          </p>
        </section>

        <section className="mb-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">9. Changes to this policy</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            We may update this Privacy Policy to reflect changes to our practices, technology, or legal requirements. When we do,
            we will revise the effective date at the top of this page and, where appropriate, notify you via email or in-app
            messaging.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold">10. Contact us</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Questions about this policy or our data practices? Email{' '}
            <a href="mailto:contact@realvisionaire.com" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              contact@realvisionaire.com
            </a>
            . You can also return to the{' '}
            <Link to="/" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              home page
            </Link>{' '}
            or review our{' '}
            <Link to="/pricing" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              pricing plans
            </Link>{' '}
            to learn more about our Services.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;


