import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { LifeBuoy } from 'lucide-react';

const faqs = [
  {
    question:
      'How does PayrollFiti calculate statutory deductions in Kenya, Nigeria, and South Africa?',
    answer:
      "We apply each country's current statutory rules automatically on every payroll run — PAYE bands, personal relief, NSSF, and SHIF for Kenya; PAYE, Pension, and NHF for Nigeria; PAYE, UIF, and SDL for South Africa — so you don't have to track rate changes manually.",
  },
  {
    question: 'Can I run payroll for the same period twice?',
    answer:
      'Running the same period twice returns the existing run instead of double-processing employees, unless salary data changed since the last run.',
  },
  {
    question: 'How do employees access their payslips?',
    answer:
      'Employees sign in to the Employee Portal to view and download their own payslips and update their profile — no need to email HR for copies.',
  },
  {
    question: 'What happens if I lose internet connectivity?',
    answer:
      "The Employee Portal caches your most recent profile and payslip data locally, so it stays viewable while offline and re-syncs automatically once you're back online.",
  },
  {
    question: 'How do I change my subscription plan?',
    answer:
      'Go to Settings → Billing in the app to view available plans, upgrade, downgrade, or review past invoices.',
  },
  {
    question: 'Is my payroll data secure?',
    answer:
      'Sensitive fields like statutory identifiers and bank account numbers are encrypted at rest, and access is scoped by role within your organization. See our Privacy Policy for details.',
  },
];

export default function HelpPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border-2 border-border mb-4">
            <LifeBuoy className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Help Center
          </h1>
          <p className="text-lg text-muted-foreground">
            Answers to common questions. Can&apos;t find what you need?
          </p>
        </div>

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Accordion type="single" collapsible>
              {faqs.map((faq) => (
                <AccordionItem key={faq.question} value={faq.question}>
                  <AccordionTrigger className="text-left font-bold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="text-center bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle>Still need help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-primary-foreground/90 mb-4">
              Our support team is happy to help with anything payroll or
              compliance related.
            </p>
            <Button asChild className="bg-white text-primary hover:bg-white">
              <Link href="/contact">Contact Support</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
