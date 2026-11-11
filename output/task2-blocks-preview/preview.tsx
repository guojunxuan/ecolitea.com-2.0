import React from 'react'
import { createRoot } from 'react-dom/client'
import { ProseBlock } from '../../src/blocks/Prose/Component'
import { KeyTakeawaysBlock } from '../../src/blocks/KeyTakeaways/Component'
import { BannerBlock } from '../../src/blocks/Banner/Component'
import { CallToActionBlock } from '../../src/blocks/CallToAction/Component'
import { MediaBlock } from '../../src/blocks/MediaBlock/Component'
import '../../src/styles/base.css'
import '../../src/styles/layout.css'
import '../../src/styles/tokens.css'
import '../../src/styles/typography.css'
import '../../src/styles/content.css'
const text = (value: string) => ({root:{type:'root',version:1,children:[{type:'paragraph',version:1,children:[{type:'text',version:1,text:value,format:0}]}]}}) as never
const picture = {id:'preview',url:'/website-template-OG.webp',mimeType:'image/webp',alt:'Media preview',width:1200,height:630,updatedAt:'2026-10-02T00:00:00Z'} as never
createRoot(document.getElementById('root')!).render(<main style={{padding:'24px',fontFamily:'sans-serif',display:'grid',gap:'32px'}}>
<ProseBlock blockType="prose" content={text('A practical guide to choosing and brewing tea. This text stays in a comfortable reading column.')} />
<KeyTakeawaysBlock blockType="keyTakeaways" content={text('Start with fresh water. Adjust time and temperature to taste.')} />
<BannerBlock blockType="banner" style="warning" title="Brewing temperature" content={text('Let boiling water cool before pouring over green tea.')} />
<MediaBlock blockType="mediaBlock" media={picture} width="wide" caption={text('A wide media block with an editorial caption.')} />
<CallToActionBlock blockType="cta" heading="Discover your daily tea" description={text('Find a blend for every moment.')} links={[{link:{type:'custom',url:'/tea',label:'Explore tea',appearance:'outline'}}]} />
<CallToActionBlock blockType="cta" heading="A tea for slower mornings" theme="inverse" media={picture} description={text('Carefully chosen leaves and a simple daily ritual.')} />
</main>)
