async (page) => {
  const plans = [{"title": "Insta360 Link 2 Pro · 示例 08", "slug": "demo-insta360-link-2-pro", "media": "Insta360 Link 2 Pro — product image from Insta360", "scenes": ["Videography", "Vlogging"], "use": "桌面影像内容演示", "summary": "复用站内 Link 2 Pro 产品图与场景素材的完整示例，包含图库、卖点、规格及两段产品 sections，用于后台编辑与内容结构演示。", "highlights": ["Link 2 Pro 产品外观与真实场景素材组合展示", "以现有 Product Blocks 组织可重复编辑的详情内容"], "banner": "Link 2 Pro，让创作成为日常", "bannerCopy": "围绕 Link 2 Pro 建立从产品展示到应用场景的内容叙事，所有图片均复用站内素材。此为本地演示内容。", "sceneTitle": "为桌面内容建立清晰的表达", "body": "通过 Videography 与 Vlogging 两类现有场景素材，展示 Link 2 Pro 产品内容的图文组合方式。编辑者可以调整章节名称、媒体位置和段落内容。此为本地演示文案，具体技术参数以正式产品资料为准。", "order": 8}];
  const api = 'http://localhost:3000/api';
  const sourceID = '6adcb636f43c3bb2c41ea3f2';
  const categoryID = '6adcb95ef43c3bb2c41ea3f5';
  const auth = await (await page.request.get(api + '/users/me')).json();
  if (!auth.user) throw new Error('Authentication expired');
  const sourceResponse = await page.request.get(api + '/products/' + sourceID + '?draft=true&depth=0');
  if (!sourceResponse.ok()) throw new Error('Could not read the saved section template');
  const source = await sourceResponse.json();
  const mediaResponse = await page.request.get(api + '/media?limit=100&depth=0');
  const media = (await mediaResponse.json()).docs;
  const findMedia = (alt) => {
    const found = media.filter(m => m.alt === alt && m.mimeType?.startsWith('image/'));
    if (found.length !== 1) throw new Error('Expected one existing media for: ' + alt);
    return found[0].id;
  };
  const paragraph = (text) => {
    const original = source.sections[1].blocks[0].body;
    const doc = JSON.parse(JSON.stringify(original));
    const row = doc.root.children[0];
    row.children = [{...row.children[0], text}];
    doc.root.children = [row];
    return doc;
  };
  const cleanBlock = (block) => {
    const {id, blockName, ...fields} = block;
    return JSON.parse(JSON.stringify(fields));
  };
  const results = [];
  for (const [index, p] of plans.entries()) {
    const existingResponse = await page.request.get(api + '/products?draft=true&depth=0&limit=100');
    const existing = (await existingResponse.json()).docs.find(d => d.slug === p.slug);
    if (existing) throw new Error('Slug already exists; refusing duplicate or overwrite: ' + p.slug);
    const productMedia = findMedia(p.media);
    const scenes = p.scenes.map(findMedia);
    const {content: legacyContent, ...bannerBase} = cleanBlock(source.sections[0].blocks[0]);
    const banner = {...bannerBase, title:p.banner, body:p.bannerCopy, media:productMedia, playback:'ambient'};
    const text = {...cleanBlock(source.sections[1].blocks[0]), title:p.sceneTitle, body:paragraph(p.body), media:scenes[0], playback:'ambient', mediaPosition:(p.order || index) % 2 ? 'left':'right'};
    const sections = [
      {label:'产品亮点', anchor:'product-story', blocks:[banner]},
      {label:'使用场景', anchor:'creative-scenes', blocks:[text]},
    ];
    const extra = 2;
    if (extra === 0) sections.push({label:'更多视角',anchor:'media-gallery',blocks:[{
      blockType:'productMediaCarousel',eyebrow:'MORE ANGLES',title:p.title.split(' · ')[0] + ' 的内容视角',
      slides:[{media:productMedia,playback:'ambient',caption:'产品外观展示'},{media:scenes[0],playback:'ambient',caption:'使用场景示意'}],aspectRatio:'16:9',theme:'default',
    }]});
    if (extra === 1) sections.push({label:'场景切换',anchor:'scene-tabs',blocks:[{
      blockType:'productMediaTabs',title:'选择你的创作场景',
      tabs:[{title:'产品外观',media:productMedia,playback:'ambient'},{title:'使用场景',media:scenes[0],playback:'ambient'}],aspectRatio:'4:3',theme:'default',
    }]});
    if (extra === 2) sections.push({label:'内容说明',anchor:'product-notes',blocks:[{
      blockType:'productMediaAccordion',eyebrow:'PRODUCT NOTES',title:'创作前，先想好你的故事',
      items:[{title:'产品展示',body:paragraph('使用现有产品媒体呈现外观与内容主题。这是本地示例数据，不包含未经核实的技术参数。'),media:productMedia,playback:'ambient'},
        {title:'使用场景',body:paragraph(p.body),media:scenes[0],playback:'ambient'}],
      defaultMedia:productMedia,mediaPosition:'right',aspectRatio:'1:1',theme:'default',
    }]});
    if (extra === 3) sections.push({label:'创作提示',anchor:'creative-note',blocks:[{
      blockType:'productCode',label:p.title.split(' · ')[0]+' 演示卡片',
      html:'<article class="demo-note"><p class="eyebrow">CREATIVE NOTE</p><h2>让每一段故事都有自己的视角</h2><p>这是复用现有产品资产的本地演示内容。</p><img src="{{asset:0}}" alt="产品示意图"></article>',
      css:'.demo-note{padding:32px;color:var(--color-foreground);background:var(--color-background)}.eyebrow{letter-spacing:.16em;font-size:12px}img{display:block;max-width:100%;height:auto}',
      assets:[productMedia],minHeight:400,width:'standard',theme:'default',
    }]});
    const data = {title:p.title,slug:p.slug,summary:p.summary,_status:'draft',category:categoryID,
      gallery:[productMedia,...scenes],highlights:p.highlights.map(text=>({text})),
      specifications:[{group:'演示信息',label:'内容用途',value:p.use},{group:'展示配置',label:'素材来源',value:'站内已有 Media'}],
      inquiry:{mode:'default'},sections};
    const created = await page.request.post(api + '/products', {data});
    const response = await created.json();
    if (!created.ok()) throw new Error('Create failed for ' + p.slug + ': ' + JSON.stringify(response));
    const id = response.doc?.id || response.id;
    if (!id) throw new Error('Creation response did not return an ID');
    const savedResponse = await page.request.get(api + '/products/' + id + '?draft=true&depth=0');
    const saved = await savedResponse.json();
    if (!savedResponse.ok() || saved.title !== p.title || saved.slug !== p.slug || saved._status !== 'draft' || saved.sections?.length !== 3
      || saved.sections.some(s=>s.blocks?.length !== 1) || saved.gallery?.length !== 3) throw new Error('Saved content verification failed for ' + id);
    results.push({id:saved.id,title:saved.title,slug:saved.slug,status:saved._status,category:saved.category,
      gallery:saved.gallery.length,highlights:saved.highlights.length,specifications:saved.specifications.length,
      sections:saved.sections.map(s=>({label:s.label,anchor:s.anchor,blocks:s.blocks.map(b=>b.blockType)})),
      createdVia:'Playwright authenticated Payload REST API',verifiedVia:'read-only Payload API'});
  }
  return results;
}
