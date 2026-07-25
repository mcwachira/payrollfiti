import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export interface P9BrandingProps {
  appName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface P9MonthRow {
  /** e.g. "2026-01" */
  period: string;
  grossPay: number;
  nssf: number;
  taxableIncome: number;
  grossTax: number;
  relief: number;
  payeTax: number;
}

export interface P9DocumentProps {
  branding: P9BrandingProps;
  companyName: string;
  employeeName: string;
  employeeNumber?: string | null;
  kraPin?: string | null;
  taxYear: string;
  currency: string;
  rows: P9MonthRow[];
  totals: P9MonthRow;
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  appName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 14, marginBottom: 12, fontWeight: 700 },
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
  colMonth: { width: '14%' },
  colAmount: { width: '17%', textAlign: 'right' },
});

function Row({ row, bold }: { row: P9MonthRow; bold?: boolean }) {
  return (
    <View style={bold ? styles.totalsRow : styles.tableRow}>
      <Text style={styles.colMonth}>{row.period}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.grossPay)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.nssf)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.taxableIncome)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.grossTax)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.relief)}</Text>
      <Text style={styles.colAmount}>{formatNumber(row.payeTax)}</Text>
    </View>
  );
}

export function P9Document(props: P9DocumentProps) {
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

        <Text style={styles.title}>P9 Tax Deduction Card — {props.taxYear}</Text>
        <View style={styles.metaRow}>
          <Text>Employee: {props.employeeName}</Text>
          <Text>No: {props.employeeNumber ?? '-'}</Text>
          <Text>KRA PIN: {props.kraPin ?? '-'}</Text>
          <Text>Currency: {props.currency}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colMonth}>Month</Text>
            <Text style={styles.colAmount}>Gross Pay</Text>
            <Text style={styles.colAmount}>NSSF</Text>
            <Text style={styles.colAmount}>Taxable Pay</Text>
            <Text style={styles.colAmount}>Tax Charged</Text>
            <Text style={styles.colAmount}>Personal Relief</Text>
            <Text style={styles.colAmount}>PAYE Tax</Text>
          </View>
          {props.rows.map((row) => (
            <Row row={row} key={row.period} />
          ))}
          <Row row={{ ...props.totals, period: 'TOTAL' }} bold />
        </View>
      </Page>
    </Document>
  );
}
