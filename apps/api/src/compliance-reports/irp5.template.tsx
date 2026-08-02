import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export interface Irp5BrandingProps {
  appName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface Irp5MonthRow {
  /** e.g. "2026-01" */
  period: string;
  grossRemuneration: number;
  uifContribution: number;
  taxableIncome: number;
  payeTax: number;
}

export interface Irp5DocumentProps {
  branding: Irp5BrandingProps;
  companyName: string;
  employeeName: string;
  employeeNumber?: string | null;
  /** SARS Income Tax reference number */
  taxIdNumber?: string | null;
  taxYear: string;
  currency: string;
  rows: Irp5MonthRow[];
  totals: Irp5MonthRow;
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  appName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 14, marginBottom: 4, fontWeight: 700 },
  disclaimer: { fontSize: 7, color: '#666', marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  table: { marginTop: 12 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  totalsRow: {
    flexDirection: 'row',
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#000',
    fontWeight: 700,
  },
  colMonth: { width: '18%' },
  colAmount: { width: '20%', textAlign: 'right' },
  codesFooter: { marginTop: 16, fontSize: 7, color: '#666' },
});

function Row({ row, bold }: { row: Irp5MonthRow; bold?: boolean }) {
  return (
    <View style={bold ? styles.totalsRow : styles.tableRow}>
      <Text style={styles.colMonth}>{row.period}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.grossRemuneration)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.uifContribution)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.taxableIncome)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.payeTax)}</Text>
    </View>
  );
}

/**
 * Best-effort IRP5-style annual employee tax certificate summary, built from
 * already-persisted payroll figures. This is NOT a SARS e@syFile-ready
 * submission (that requires the full IT3 CSV/XML layout and SARS-issued
 * certificate numbering) — it's a readable summary an employer can use to
 * complete the official submission. Source code 4102 (PAYE amount) is the
 * only SARS code annotated here since it's the one verified against SARS's
 * published codes guide; other lines use plain-English labels rather than
 * guessed codes.
 */
export function Irp5Document(props: Irp5DocumentProps) {
  const accent = props.branding.primaryColor ?? '#111827';

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.appName, { color: accent }]}>{props.branding.appName}</Text>
            <Text>{props.companyName}</Text>
          </View>
          {props.branding.logoUrl ? <Image style={styles.logo} src={props.branding.logoUrl} /> : null}
        </View>

        <Text style={styles.title}>IRP5 Employee Tax Certificate Summary — {props.taxYear}</Text>
        <Text style={styles.disclaimer}>
          Summary for internal/employer use. Submit via SARS e@syFile or eFiling for an official IRP5/IT3(a).
        </Text>
        <View style={styles.metaRow}>
          <Text>Employee: {props.employeeName}</Text>
          <Text>No: {props.employeeNumber ?? '-'}</Text>
          <Text>Income Tax Ref No: {props.taxIdNumber ?? '-'}</Text>
          <Text>Currency: {props.currency}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colMonth}>Month</Text>
            <Text style={styles.colAmount}>Gross Remuneration</Text>
            <Text style={styles.colAmount}>UIF Contribution</Text>
            <Text style={styles.colAmount}>Taxable Income</Text>
            <Text style={styles.colAmount}>PAYE (code 4102)</Text>
          </View>
          {props.rows.map((row) => (
            <Row row={row} key={row.period} />
          ))}
          <Row row={{ ...props.totals, period: 'TOTAL' }} bold />
        </View>

        <Text style={styles.codesFooter}>
          Certificate type: IRP5 (source code 3015) if PAYE {'>'} 0 for the year, otherwise IT3(a) (code 4150) applies.
        </Text>
      </Page>
    </Document>
  );
}
