/*
  Report PDF generator using @react-pdf/renderer
*/
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font
} from '@react-pdf/renderer'
import type { ReportData, KPI, CoreWebVitals, KeywordRow, Issue, TrendPoint } from './types'

// Fonts (fallback to system fonts available in renderer)
try {
  Font.register({ family: 'Inter', fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fv.ttf' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fv.ttf', fontWeight: 600 }
  ] })
} catch (e) {
  // In test or restricted environments, font registration can fail; continue with defaults
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Inter', color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  siteBlock: {},
  siteName: { fontSize: 16, fontWeight: 600 },
  siteDomain: { fontSize: 10, color: '#6B7280' },
  section: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  sectionTitle: { fontSize: 12, fontWeight: 600, marginBottom: 8 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiCard: { width: '25%', padding: 8 },
  kpiLabel: { fontSize: 10, color: '#6B7280' },
  kpiValue: { fontSize: 18, fontWeight: 600 },
  kpiDelta: { fontSize: 9 },
  perfGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  perfItem: { width: '33.33%', padding: 8 },
  table: { display: 'table', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB' },
  tableRow: { flexDirection: 'row' },
  tableCell: { padding: 6, fontSize: 9, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  tableHeader: { backgroundColor: '#F9FAFB', fontWeight: 600 },
  issueRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  small: { fontSize: 9, color: '#6B7280' },
})

// Helpers
const pct = (v?: number) => (v == null ? '-' : `${(v * 100).toFixed(1)}%`)
const num = (v?: number | string) => (v == null ? '-' : typeof v === 'number' ? v.toLocaleString() : v)

// Simple gauge as text bar (PDF friendly)
function Gauge({ score }: { score?: number }) {
  const s = Math.max(0, Math.min(100, score ?? 0))
  const filled = Math.round((s / 100) * 20)
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
  return (
    <View>
      <Text style={{ fontSize: 10, marginBottom: 4 }}>SEO Score</Text>
      <Text style={{ fontSize: 14, fontWeight: 600 }}>{s}/100</Text>
      <Text style={{ fontSize: 10, color: '#6B7280' }}>{bar}</Text>
    </View>
  )
}

function KPIs({ items }: { items: KPI[] }) {
  return (
    <View style={styles.kpiGrid}>
      {items.map((k, i) => (
        <View key={i} style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{k.label}</Text>
          <Text style={styles.kpiValue}>{num(k.value)}</Text>
          {k.delta != null && (
            <Text style={[styles.kpiDelta, { color: k.delta >= 0 ? '#059669' : '#DC2626' }]}>
              {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}%
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}

function Perf({ data }: { data?: CoreWebVitals }) {
  if (!data) return null
  const items = [
    { label: 'LCP', value: data.lcp, suffix: 's' },
    { label: 'INP', value: data.inp, suffix: 'ms' },
    { label: 'CLS', value: data.cls },
    { label: 'TTFB', value: data.ttfb, suffix: 'ms' },
    { label: 'FCP', value: data.fcp, suffix: 's' },
    { label: 'Speed Index', value: data.speedIndex, suffix: 's' },
  ]
  return (
    <View style={styles.perfGrid}>
      {items.map((it, i) => (
        <View key={i} style={styles.perfItem}>
          <Text style={styles.kpiLabel}>{it.label}</Text>
          <Text style={styles.kpiValue}>{num(it.value)}{it.suffix ? ` ${it.suffix}` : ''}</Text>
        </View>
      ))}
    </View>
  )
}

function KeywordsTable({ rows }: { rows?: KeywordRow[] }) {
  if (!rows?.length) return null
  const headers = ['Keyword', 'Clicks', 'Impr.', 'CTR', 'Pos.']
  return (
    <View style={[styles.table, { marginTop: 4 }]}> 
      <View style={[styles.tableRow, styles.tableHeader]}>
        {headers.map((h, i) => (
          <Text key={i} style={[styles.tableCell, { width: i === 0 ? 160 : 70 }]}>{h}</Text>
        ))}
      </View>
      {rows.slice(0, 10).map((r, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: 160 }]}>{r.keyword}</Text>
          <Text style={[styles.tableCell, { width: 70 }]}>{num(r.clicks)}</Text>
          <Text style={[styles.tableCell, { width: 70 }]}>{num(r.impressions)}</Text>
          <Text style={[styles.tableCell, { width: 70 }]}>{pct(r.ctr)}</Text>
          <Text style={[styles.tableCell, { width: 70 }]}>{r.position.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  )
}

function IssuesList({ items }: { items?: Issue[] }) {
  if (!items?.length) return null
  const color = (s: Issue['severity']) => ({
    critical: '#991B1B',
    high: '#DC2626',
    medium: '#D97706',
    low: '#6B7280',
  }[s])
  return (
    <View>
      {items.map((it) => (
        <View key={it.id} style={styles.issueRow}>
          <Text style={{ fontSize: 10, fontWeight: 600 }}>{it.title}</Text>
          <Text style={{ fontSize: 10, color: color(it.severity) }}>{it.severity.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  )
}

// Tiny trend chart approximation (sparklines as unicode blocks per metric)
function Trends({ points }: { points?: TrendPoint[] }) {
  if (!points?.length) return null
  const toSpark = (arr: number[]) => {
    if (!arr.length) return ''
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    const blocks = ['▁','▂','▃','▄','▅','▆','▇','█']
    return arr.map(v => {
      const i = max === min ? 0 : Math.round(((v - min) / (max - min)) * (blocks.length - 1))
      return blocks[i]
    }).join('')
  }
  const clicks = toSpark(points.map(p => p.clicks))
  const impr = toSpark(points.map(p => p.impressions))
  const pos = toSpark(points.map(p => -p.position)) // invert (lower is better)
  const ctr = toSpark(points.map(p => p.ctr))
  return (
    <View>
      <Text style={styles.small}>30-day trends</Text>
      <Text style={styles.small}>Clicks: {clicks}</Text>
      <Text style={styles.small}>Impr.: {impr}</Text>
      <Text style={styles.small}>Position: {pos}</Text>
      <Text style={styles.small}>CTR: {ctr}</Text>
    </View>
  )
}

export function ReportPDF({ data }: { data: ReportData }) {
  const { site, period, generatedAt, seoScore } = data
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.siteBlock}>
            <Text style={styles.siteName}>{site.name}</Text>
            <Text style={styles.siteDomain}>{site.domain} • {period.label}</Text>
            <Text style={styles.small}>Generated {new Date(generatedAt).toLocaleString()}</Text>
          </View>
          <View>
            <Gauge score={seoScore} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KPIs</Text>
          <KPIs items={data.kpis} />
        </View>

        {data.performance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance (Core Web Vitals)</Text>
            <Perf data={data.performance} />
          </View>
        )}

        {!!data.topKeywords?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Keywords</Text>
            <KeywordsTable rows={data.topKeywords} />
          </View>
        )}

        {!!data.issues?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issues</Text>
            <IssuesList items={data.issues} />
          </View>
        )}

        {!!data.trends?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trends (30 days)</Text>
            <Trends points={data.trends} />
          </View>
        )}
      </Page>
    </Document>
  )
}

// Utility to render to Buffer (Node runtime)
import { pdf } from '@react-pdf/renderer'
export async function renderReportPDF(data: ReportData): Promise<Buffer> {
  const instance = pdf(<ReportPDF data={data} />)
  const buf = await instance.toBuffer()
  return buf
}
