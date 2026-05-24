'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { feature } from 'topojson-client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import topoData from 'world-atlas/countries-110m.json'
import { supabase } from '@/lib/supabase-browser'

// react-globe.gl использует WebGL — рендер только на клиенте
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })

// numeric ISO 3166-1 (id в world-atlas) → alpha-2 код наших стран
const ISO_NUM_TO_CODE: Record<string, string> = {
  '643': 'RU',
  '360': 'ID',
  '764': 'TH',
  '784': 'AE',
  '268': 'GE',
  '376': 'IL',
  '112': 'BY',
  '840': 'US',
  '704': 'VN',
}

interface DbCountry {
  id: number
  code: string
  name_ru: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Feature = any

export function GlobeSelect({
  onSelect,
  onBack,
}: {
  onSelect: (countryId: string) => void
  onBack: () => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null)
  const [countries, setCountries] = useState<DbCountry[]>([])
  const [size, setSize] = useState({ w: 360, h: 480 })
  const [hoverD, setHoverD] = useState<Feature | null>(null)

  // Активные страны из БД
  useEffect(() => {
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('countries')
        .select('id, code, name_ru')
        .eq('status', 'active')
      setCountries(data || [])
    }
    load()
  }, [])

  // GeoJSON полигоны стран (без Антарктиды)
  const features = useMemo<Feature[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = feature(topoData as any, (topoData as any).objects.countries) as any
    return fc.features.filter((f: Feature) => f.id !== '010')
  }, [])

  const activeCodes = useMemo(() => new Set(countries.map((c) => c.code)), [countries])

  const countryByCode = useMemo(() => {
    const m = new Map<string, DbCountry>()
    countries.forEach((c) => m.set(c.code, c))
    return m
  }, [countries])

  const isActive = (feat: Feature): boolean => {
    const code = ISO_NUM_TO_CODE[String(feat.id)]
    return !!code && activeCodes.has(code)
  }

  // Размер под экран MiniApp
  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: Math.max(320, window.innerHeight - 140) })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Автовращение + камера — настраиваем когда глобус реально готов (onGlobeReady).
  // useEffect не годится: Globe грузится через dynamic import, ref ещё пуст.
  const configureControls = () => {
    const g = globeEl.current
    if (!g) return
    const c = g.controls()
    c.autoRotate = true
    c.autoRotateSpeed = 0.6
    c.enableZoom = true
    c.enablePan = false
    g.pointOfView({ lat: 30, lng: 60, altitude: 2.4 })
  }

  const handleClick = (polygon: Feature) => {
    const code = ISO_NUM_TO_CODE[String(polygon.id)]
    if (!code) return
    const country = countryByCode.get(code)
    if (country) onSelect(String(country.id))
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a14] text-white overflow-hidden">
      <div className="absolute top-0 inset-x-0 z-10 pt-6 px-6 text-center pointer-events-none">
        <h1 className="text-2xl font-bold mb-1">Выберите страну</h1>
        <p className="text-sm text-gray-300">Крутите глобус и нажмите на подсвеченную страну</p>
      </div>

      <Globe
        ref={globeEl}
        onGlobeReady={configureControls}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
        atmosphereColor="#3a7bd5"
        atmosphereAltitude={0.18}
        polygonsData={features}
        polygonAltitude={(d: Feature) => (d === hoverD && isActive(d) ? 0.1 : isActive(d) ? 0.06 : 0.005)}
        polygonCapColor={(d: Feature) =>
          isActive(d)
            ? d === hoverD
              ? 'rgba(120,190,255,1)'
              : 'rgba(70,150,255,0.85)'
            : 'rgba(110,110,130,0.12)'
        }
        polygonSideColor={() => 'rgba(40,110,200,0.2)'}
        polygonStrokeColor={(d: Feature) => (isActive(d) ? '#9cc8ff' : 'rgba(90,90,110,0.25)')}
        polygonLabel={(d: Feature) => {
          const c = countryByCode.get(ISO_NUM_TO_CODE[String(d.id)] ?? '')
          return c ? `<b style="color:#fff">${c.name_ru}</b>` : ''
        }}
        onPolygonHover={(d: Feature | null) => setHoverD(isActive(d) ? d : null)}
        onPolygonClick={handleClick}
        polygonsTransitionDuration={250}
      />

      <div className="absolute bottom-0 inset-x-0 z-10 p-6">
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 rounded-lg font-medium bg-white/10 text-white backdrop-blur border border-white/15 hover:bg-white/20 transition"
        >
          Назад
        </button>
      </div>
    </div>
  )
}
