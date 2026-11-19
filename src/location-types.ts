export interface CityLocation {
  id: number
  name: string
  region: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
}

export interface LocationSearchResult {
  query: string
  locations: CityLocation[]
}
