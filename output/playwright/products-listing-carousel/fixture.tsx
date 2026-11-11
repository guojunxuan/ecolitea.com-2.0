import React from 'react'
import { ProductListingHero } from '@/heros/ProductListingHero'
import { CategoryCarousel } from '@/components/Products/CategoryCarousel'
import { AnchorNav } from '@/components/Products/AnchorNav'
import '@/app/(frontend)/globals.css'
import data from './fixture-data.json'
const image = data.media
export const slides = [
  { id: 'first', media: image, eyebrow: 'New collection', title: 'Made for your next adventure', description: 'Explore thoughtful products for every journey.', theme: 'dark' as const, position: 'left' as const, cta: { type: 'custom' as const, url: '#category-0', label: 'Explore the range' } },
  { id: 'second', media: image, eyebrow: 'Discover more', title: 'A fresh perspective', description: 'Find the right fit for your next project.', theme: 'light' as const, position: 'right' as const, cta: { type: 'custom' as const, url: '#category-1', label: 'View collection' } },
  { id: 'third', media: { ...image, id:'video', mimeType: 'video/mp4', url: '/fixture.mp4', durationSeconds: 3 }, eyebrow: 'In motion', title: 'See what comes next', description: 'Video slide playback verification.', theme: 'dark' as const, position: 'center' as const, cta: { type: 'custom' as const, url: '#category-2', label: 'Explore video range' } },
]
const items=Array.from({length:14},(_,i)=>({id:`category-${i}`,title:`Collection ${i+1}`,href:`#category-${i}`,image}))
export const Fixture=()=> <>
  <header style={{position:'absolute',top:0,zIndex:20,padding:'20px 24px',color:'white',fontWeight:600}}>ECOLITEA — Component verification</header>
  <ProductListingHero slides={slides}/>
  <CategoryCarousel items={items}/>
  <AnchorNav variant="category" items={items.map(({id,title})=>({id,label:title}))}/>
  {items.map(({id,title})=><section key={id} id={id} style={{minHeight:400,padding:'60px 24px',scrollMarginTop:'140px',borderTop:'1px solid var(--website-color-border)'}}><h2>{title}</h2><p>Current-page category destination.</p></section>)}
</>
