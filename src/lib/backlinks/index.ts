import type { BacklinkProvider } from './provider'
import { GSCBacklinkProvider } from './gsc-provider'

const providers: Record<string, () => BacklinkProvider> = {
  gsc: () => new GSCBacklinkProvider(),
}

export function getBacklinkProvider(): BacklinkProvider {
  const name = process.env.BACKLINK_PROVIDER || 'gsc'
  const factory = providers[name]
  if (!factory) throw new Error(`Unknown backlink provider: ${name}. Valid: ${Object.keys(providers).join(', ')}`)
  return factory()
}

export type { BacklinkProvider, BacklinkData, BacklinkCredentials, ReferringDomainData } from './provider'
