export type ReferringDomainData = {
  domain: string
  linkCount: number
}

export type BacklinkData = {
  totalLinks: number
  totalReferringDomains: number
  referringDomains: ReferringDomainData[]
}

export type BacklinkCredentials = {
  siteUrl: string
  refreshToken?: string
  apiKey?: string
}

export interface BacklinkProvider {
  name: string
  fetchBacklinks(creds: BacklinkCredentials): Promise<BacklinkData>
  fetchReferringDomains(creds: BacklinkCredentials): Promise<ReferringDomainData[]>
}
