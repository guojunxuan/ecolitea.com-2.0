async (page) => {
  const p = {"title": "Insta360 Flow 2 Series · 示例 07", "slug": "demo-insta360-flow-2-series", "media": "Insta360 Flow 2 Series — product image from Insta360", "scenes": ["Vlogging", "Family Moments"], "use": "移动创作内容演示", "summary": "复用站内 Flow 2 Series 产品图与场景素材的完整示例，包含图库、卖点、规格及两段产品 sections，用于后台编辑与内容结构演示。", "highlights": ["Flow 2 Series 产品外观与真实场景素材组合展示", "以现有 Product Blocks 组织可重复编辑的详情内容"], "banner": "Flow 2 Series，让创作成为日常", "bannerCopy": "围绕 Flow 2 Series 建立从产品展示到应用场景的内容叙事，所有图片均复用站内素材。此为本地演示内容。", "sceneTitle": "把故事从构思带到画面", "body": "通过 Vlogging 与 Family Moments 两类现有场景素材，展示 Flow 2 Series 产品内容的图文组合方式。编辑者可以调整章节名称、媒体位置和段落内容。此为本地演示文案，具体技术参数以正式产品资料为准。"};
  const category = '影像设备 · 示例';
  const fill = async (id, value) => page.locator('#field-' + id).fill(value);
  const expandRow = async (id) => {
    const input = page.locator('#field-' + id);
    await input.waitFor({state: 'attached'});
    if (!(await input.isVisible())) await page.getByRole('button', {name: 'Expand', exact: true}).last().click();
    await input.waitFor({state: 'visible'});
  };
  const chooseOne = async (name) => {
    await page.getByRole('button', {name: 'Choose from existing', exact: true}).click();
    const d = page.getByRole('dialog');
    await d.getByRole('button', {name, exact: true}).click();
    await d.waitFor({state: 'hidden'});
  };
  const addBlock = async (name) => {
    await page.getByRole('button', {name: 'Add Block', exact: true}).last().click();
    const d = page.getByRole('dialog');
    await d.getByRole('button', {name, exact: true}).click();
    await d.getByRole('button', {name: 'Insert', exact: true}).click();
    await d.waitFor({state: 'hidden'});
  };
  await page.goto('http://localhost:3000/admin/collections/products/create');
  await page.waitForURL(/\/admin\/collections\/products\/[a-f0-9]{24}$/);
  const id = page.url().split('/').pop();
  await page.getByRole('tab', {name: 'Overview', exact: true}).click();
  await fill('title', p.title);
  await fill('summary', p.summary);
  if (await page.getByRole('textbox', {name: 'Slug', exact: true}).isDisabled()) {
    await page.getByRole('button', {name: 'Unlock', exact: true}).click();
  }
  await fill('slug', p.slug);
  await page.getByRole('combobox', {name: 'Category', exact: true}).click();
  await page.getByRole('option', {name: category, exact: true}).click();
  await page.getByRole('button', {name: 'Choose from existing', exact: true}).click();
  const gallery = page.getByRole('dialog');
  for (const name of [p.media, ...p.scenes]) {
    await gallery.getByRole('row').filter({has: page.getByRole('button', {name, exact: true})}).getByRole('checkbox').check();
  }
  await gallery.getByRole('button', {name: 'Select 3', exact: true}).click();
  await gallery.waitFor({state: 'hidden'});
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', {name: 'Add Highlight', exact: true}).click();
    await expandRow('highlights__' + i + '__text');
    await fill('highlights__' + i + '__text', p.highlights[i]);
  }
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', {name: 'Add Specification', exact: true}).click();
    await expandRow('specifications__' + i + '__group');
    await fill('specifications__' + i + '__group', i === 0 ? '演示信息' : '展示配置');
    await fill('specifications__' + i + '__label', i === 0 ? '内容用途' : '素材来源');
    await fill('specifications__' + i + '__value', i === 0 ? p.use : '站内已有 Media');
  }
  await page.getByRole('tab', {name: 'Details', exact: true}).click();
  await page.getByRole('button', {name: 'Add Section', exact: true}).click();
  await expandRow('sections__0__label');
  await fill('sections__0__label', '产品亮点');
  await fill('sections__0__anchor', 'product-story');
  await addBlock('Media Banner');
  await fill('sections__0__blocks__0__title', p.banner);
  await fill('sections__0__blocks__0__content', p.bannerCopy);
  await chooseOne(p.media);
  await page.getByRole('button', {name: 'Add Section', exact: true}).click();
  await expandRow('sections__1__label');
  await fill('sections__1__label', '使用场景');
  await fill('sections__1__anchor', 'creative-scenes');
  await addBlock('Media + Text');
  await fill('sections__1__blocks__0__eyebrow', 'CREATIVE SCENES');
  await fill('sections__1__blocks__0__title', p.sceneTitle);
  await page.locator('[contenteditable="true"]').fill(p.body);
  await chooseOne(p.scenes[0]);
  let doc;
  for (let i = 0; i < 50; i++) {
    const response = await page.request.get('http://localhost:3000/api/products/' + id + '?draft=true&depth=0');
    if (!response.ok()) throw new Error('Read-only draft verification failed: ' + response.status());
    doc = await response.json();
    const ready = doc.title === p.title && doc.slug === p.slug && doc._status === 'draft'
      && doc.gallery?.length === 3 && doc.highlights?.length === 2 && doc.specifications?.length === 2
      && doc.sections?.length === 2 && doc.sections[0].blocks?.[0]?.media
      && doc.sections[1].blocks?.[0]?.media && JSON.stringify(doc.sections[1].blocks[0].body).includes(p.body);
    if (ready) break;
    if (i === 49) throw new Error('Draft not fully saved: ' + id);
    await page.waitForTimeout(250);
  }
  await page.reload();
  await page.locator('#field-title').waitFor();
  if (await page.locator('#field-title').inputValue() !== p.title) throw new Error('UI reload title mismatch');
  await page.getByRole('tab', {name: 'Details', exact: true}).click();
  await page.getByText('产品亮点', {exact: false}).last().waitFor();
  return {id: doc.id, title: doc.title, slug: doc.slug, status: doc._status, category: doc.category,
    gallery: doc.gallery.length, highlights: doc.highlights.length, specifications: doc.specifications.length,
    sections: doc.sections.map(s => ({label:s.label, anchor:s.anchor, blocks:s.blocks.map(b=>b.blockType)})),
    createdVia: 'Playwright Admin UI', verifiedVia: 'read-only API and Admin reload'};
}
