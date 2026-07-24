import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export interface PayslipBrandingProps {
  appName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface PayslipLineItem {
  label: string;
  amount: number;
}

export interface PayslipDocumentProps {
  branding: PayslipBrandingProps;
  companyName: string;
  employeeName: string;
  employeeNumber?: string | null;
  period: string;
  currency: string;
  earnings: PayslipLineItem[];
  statutoryDeductions: PayslipLineItem[];
  tax: PayslipLineItem;
  voluntaryDeductions: PayslipLineItem[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  appName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 14, marginBottom: 12, fontWeight: 700 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 6, borderTopWidth: 1, borderTopColor: '#000' },
  netPayBox: { marginTop: 20, padding: 12, backgroundColor: '#f2f2f2' },
  netPayLabel: { fontSize: 11 },
  netPayAmount: { fontSize: 18, fontWeight: 700 },
});

export function PayslipDocument(props: PayslipDocumentProps) {
  const accent = props.branding.primaryColor ?? '#111827';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.appName, { color: accent }]}>{props.branding.appName}</Text>
            <Text>{props.companyName}</Text>
          </View>
          {props.branding.logoUrl ? <Image style={styles.logo} src={props.branding.logoUrl} /> : null}
        </View>

        <Text style={styles.title}>Payslip — {props.period}</Text>
        <View style={styles.metaRow}>
          <Text>Employee: {props.employeeName}</Text>
          <Text>No: {props.employeeNumber ?? '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          {props.earnings.map((item) => (
            <View style={styles.row} key={item.label}>
              <Text>{item.label}</Text>
              <Text>{formatMoney(item.amount, props.currency)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>Gross Pay</Text>
            <Text>{formatMoney(props.grossPay, props.currency)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statutory Deductions</Text>
          {props.statutoryDeductions.map((item) => (
            <View style={styles.row} key={item.label}>
              <Text>{item.label}</Text>
              <Text>{formatMoney(item.amount, props.currency)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text>{props.tax.label}</Text>
            <Text>{formatMoney(props.tax.amount, props.currency)}</Text>
          </View>
          {props.voluntaryDeductions.map((item) => (
            <View style={styles.row} key={item.label}>
              <Text>{item.label}</Text>
              <Text>{formatMoney(item.amount, props.currency)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>Total Deductions</Text>
            <Text>{formatMoney(props.totalDeductions, props.currency)}</Text>
          </View>
        </View>

        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={[styles.netPayAmount, { color: accent }]}>{formatMoney(props.netPay, props.currency)}</Text>
        </View>
      </Page>
    </Document>
  );
}
