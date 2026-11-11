"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// output/playwright/settings-hero-consistency/fixture.tsx
var fixture_exports = {};
__export(fixture_exports, {
  renderFixture: () => renderFixture
});
module.exports = __toCommonJS(fixture_exports);
var import_server = require("react-dom/server");

// src/components/Media/index.tsx
var import_react2 = require("react");

// src/collections/mediaUploadPolicy.shared.ts
var MEDIA_UPLOAD_POLICY = {
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
    ratios: [
      { label: "1:1", width: 1, height: 1 },
      { label: "4:3", width: 4, height: 3 },
      { label: "3:2", width: 3, height: 2 },
      { label: "16:9", width: 16, height: 9 },
      { label: "9:16", width: 9, height: 16 },
      { label: "4:5", width: 4, height: 5 }
    ],
    ratioTolerance: 0.01
  },
  video: {
    ratios: [
      { label: "16:9", width: 16, height: 9 },
      { label: "9:16", width: 9, height: 16 },
      { label: "1:1", width: 1, height: 1 },
      { label: "4:5", width: 4, height: 5 }
    ],
    ratioTolerance: 0.01,
    maxBytes: 1e8,
    maxDurationSeconds: 10 * 60,
    mimeTypes: ["video/mp4"],
    videoCodecPrefixes: ["avc1", "avc3"],
    audioCodecPrefixes: ["mp4a.40.", "mp4a.69", "mp4a.6a", "mp4a.6b", "mp3", ".mp3"]
  }
};
var imageTypeNames = MEDIA_UPLOAD_POLICY.image.mimeTypes.map(
  (mime) => ({
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/avif": "AVIF",
    "image/gif": "GIF"
  })[mime]
).join(", ");

// src/components/Media/config.ts
var DEFAULT_IMAGE_QUALITY = 85;
var MEDIA_PRESENTATION_DEFAULTS = {
  image: {
    fit: "scale-down",
    quality: DEFAULT_IMAGE_QUALITY
  },
  video: { playback: "ambient" }
};
var MEDIA_RENDERABLE_MIME_TYPES = {
  image: MEDIA_UPLOAD_POLICY.image.mimeTypes,
  video: MEDIA_UPLOAD_POLICY.video.mimeTypes
};

// src/utilities/ui.ts
var import_clsx = require("clsx");
function cn(...inputs) {
  return (0, import_clsx.clsx)(inputs);
}

// output/playwright/settings-hero-consistency/next-image.mjs
var import_image = __toESM(require("next/image.js"), 1);
var next_image_default = import_image.default.default;
var getImageProps = import_image.default.getImageProps;

// src/components/Media/cloudflare.ts
var CLOUDFLARE_VIDEO_DIMENSION = {
  minimum: 10,
  maximum: 2e3
};
var CLOUDFLARE_VIDEO_MAX_DURATION_SECONDS = 60;
var IMAGE_QUALITY = {
  minimum: 1,
  maximum: 100
};
var MEDIA_FITS = /* @__PURE__ */ new Set(["cover", "contain", "scale-down"]);
var parseTransformSource = (source) => {
  let sourceURL;
  try {
    sourceURL = new URL(source);
  } catch {
    return void 0;
  }
  if (sourceURL.protocol !== "http:" && sourceURL.protocol !== "https:" || sourceURL.pathname.startsWith("/cdn-cgi/")) {
    return void 0;
  }
  return sourceURL;
};
var isFinitePositive = (value) => Number.isFinite(value) && value > 0;
var normalizeInteger = (value) => Math.round(value);
var normalizeFit = (fit) => fit && MEDIA_FITS.has(fit) ? fit : void 0;
var clampInteger = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, normalizeInteger(value)));
var encodePathname = (pathname) => {
  try {
    return pathname.split("/").map((segment) => encodeURIComponent(decodeURIComponent(segment))).join("/");
  } catch {
    return void 0;
  }
};
var buildCloudflareImageURL = ({
  source,
  width,
  quality,
  presentation,
  focalPoint
}) => {
  const sourceURL = parseTransformSource(source);
  const encodedPathname = sourceURL && encodePathname(sourceURL.pathname);
  if (!sourceURL || !encodedPathname || !isFinitePositive(width)) return source;
  const normalizedWidth = normalizeInteger(width);
  if (normalizedWidth < 1) return source;
  const ratio = presentation?.aspectRatio;
  if (ratio && (!isFinitePositive(ratio.width) || !isFinitePositive(ratio.height) || normalizeInteger(normalizedWidth * ratio.height / ratio.width) < 1)) {
    return source;
  }
  const fit = normalizeFit(presentation?.fit ?? MEDIA_PRESENTATION_DEFAULTS.image.fit);
  if (!fit) return source;
  const requestedQuality = quality ?? presentation?.quality ?? MEDIA_PRESENTATION_DEFAULTS.image.quality;
  if (!Number.isFinite(requestedQuality)) return source;
  const options = [`width=${normalizedWidth}`];
  if (ratio) {
    options.push(`height=${normalizeInteger(normalizedWidth * ratio.height / ratio.width)}`);
  }
  options.push(
    `fit=${fit}`,
    `quality=${clampInteger(requestedQuality, IMAGE_QUALITY.minimum, IMAGE_QUALITY.maximum)}`,
    "format=auto"
  );
  if (focalPoint && [focalPoint.x, focalPoint.y].every(
    (value) => Number.isFinite(value) && value >= 0 && value <= 100
  )) {
    options.push(`gravity=${focalPoint.x / 100}x${focalPoint.y / 100}`);
  }
  return `${sourceURL.origin}/cdn-cgi/image/${options.join(",")}${encodedPathname}${sourceURL.search}`;
};
var isCloudflareVideoEligible = ({
  source,
  durationSeconds
}) => Boolean(parseTransformSource(source)) && typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= CLOUDFLARE_VIDEO_MAX_DURATION_SECONDS;
var buildCloudflareVideoTransformURL = ({ source, presentation }, mode) => {
  const sourceURL = parseTransformSource(source);
  if (!sourceURL) return void 0;
  const { width, height } = presentation ?? {};
  if (width !== void 0 && !isFinitePositive(width) || height !== void 0 && !isFinitePositive(height)) {
    return void 0;
  }
  const fit = normalizeFit(presentation?.fit);
  if (presentation?.fit !== void 0 && !fit) return void 0;
  const options = [`mode=${mode}`];
  if (mode === "frame") options.push("time=1s");
  if (width !== void 0) {
    options.push(
      `width=${clampInteger(
        width,
        CLOUDFLARE_VIDEO_DIMENSION.minimum,
        CLOUDFLARE_VIDEO_DIMENSION.maximum
      )}`
    );
  }
  if (height !== void 0) {
    options.push(
      `height=${clampInteger(
        height,
        CLOUDFLARE_VIDEO_DIMENSION.minimum,
        CLOUDFLARE_VIDEO_DIMENSION.maximum
      )}`
    );
  }
  if (fit) options.push(`fit=${fit}`);
  return `${sourceURL.origin}/cdn-cgi/media/${options.join(",")}/${sourceURL.href}`;
};
var buildCloudflareVideoURL = (args) => buildCloudflareVideoTransformURL(args, "video") ?? args.source;
var buildCloudflareVideoPosterURL = (args) => buildCloudflareVideoTransformURL(args, "frame");

// src/cssVariables.js
var cssVariables = {
  breakpoints: {
    "3xl": 1920,
    "2xl": 1536,
    xl: 1280,
    lg: 1024,
    md: 768,
    sm: 640
  }
};

// src/utilities/getMediaUrl.ts
var getMediaUrl = (url, cacheTag, baseUrl) => {
  if (!url) return "";
  if (baseUrl && !/^https?:\/\//.test(url))
    url = `${baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
  if (cacheTag && cacheTag !== "") {
    cacheTag = encodeURIComponent(cacheTag);
  }
  return cacheTag ? `${url}${url.includes("?") ? "&" : "?"}${cacheTag}` : url;
};

// src/components/Media/ImageMedia/index.module.css
var ImageMedia_default = {
  image: "ImageMedia_image"
};

// src/components/Media/ImageMedia/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var { breakpoints } = cssVariables;
var placeholderBlur = "data:image/png;base64,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";
var ImageMedia = (props) => {
  const {
    alt: altFromProps,
    fill,
    pictureClassName,
    imgClassName,
    priority,
    resource,
    mobileResource,
    presentation,
    size: sizeFromProps,
    src: srcFromProps,
    loading: loadingFromProps
  } = props;
  let width;
  let height;
  let alt = altFromProps;
  let src = srcFromProps || "";
  if (!src && resource && typeof resource === "object") {
    const { alt: altFromResource, height: fullHeight, url, width: fullWidth } = resource;
    width = fullWidth ?? void 0;
    height = fullHeight ?? void 0;
    alt = altFromProps ?? altFromResource ?? "";
    const cacheTag = resource.updatedAt;
    src = getMediaUrl(url, cacheTag);
  }
  if (!src) return null;
  const imagePresentation = presentation?.image;
  const ratio = imagePresentation?.aspectRatio;
  const hasValidRatio = ratio && Number.isFinite(ratio.width) && Number.isFinite(ratio.height) && ratio.width > 0 && ratio.height > 0;
  const hasDimensions = typeof src !== "string" || typeof width === "number" && Number.isFinite(width) && width > 0 && typeof height === "number" && Number.isFinite(height) && height > 0;
  const useRatioFrame = !fill && !hasDimensions && hasValidRatio;
  const imageFill = fill || useRatioFrame;
  if (!imageFill && !hasDimensions) {
    if (process.env.NODE_ENV === "development") {
      console.warn("ImageMedia requires image dimensions, fill, or a valid aspect ratio.", src);
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("picture", { className: cn(pictureClassName) });
  }
  if (!fill && width && hasValidRatio) {
    height = Math.round(width * ratio.height / ratio.width);
  }
  const loader = typeof src === "string" ? ({
    quality,
    src: source,
    width: requestedWidth
  }) => buildCloudflareImageURL({
    presentation: imagePresentation,
    focalPoint: resource && typeof resource === "object" && (resource.focalX != null || resource.focalY != null) ? { x: resource.focalX ?? 50, y: resource.focalY ?? 50 } : void 0,
    quality,
    source,
    width: requestedWidth
  }) : void 0;
  const hasMobileImage = Boolean(
    mobileResource?.url && mobileResource.mimeType?.startsWith("image/")
  );
  const loading = loadingFromProps || (hasMobileImage && priority ? "eager" : !priority ? "lazy" : void 0);
  const sizes = sizeFromProps ? sizeFromProps : Object.entries(breakpoints).map(([, value]) => `(max-width: ${value}px) ${value * 2}w`).join(", ");
  const mobileProps = hasMobileImage && mobileResource ? getImageProps({
    src: getMediaUrl(mobileResource.url, mobileResource.updatedAt),
    alt: alt ?? "",
    fill: true,
    sizes,
    loader: ({ src: source, width: requestedWidth, quality }) => buildCloudflareImageURL({
      source,
      width: requestedWidth,
      quality,
      presentation: imagePresentation,
      focalPoint: { x: mobileResource.focalX ?? 50, y: mobileResource.focalY ?? 50 }
    })
  }).props : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "picture",
    {
      className: cn(pictureClassName),
      style: useRatioFrame ? {
        display: "block",
        position: "relative",
        aspectRatio: `${ratio.width} / ${ratio.height}`
      } : void 0,
      children: [
        mobileProps && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("source", { media: "(width < 48rem)", srcSet: mobileProps.srcSet, sizes }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          next_image_default,
          {
            alt: alt ?? "",
            className: cn(ImageMedia_default.image, imgClassName),
            "data-media-kind": "image",
            fill: imageFill,
            height: !imageFill ? height : void 0,
            loader,
            placeholder: "blur",
            blurDataURL: placeholderBlur,
            priority: hasMobileImage ? false : priority,
            fetchPriority: hasMobileImage && priority ? "high" : void 0,
            loading,
            sizes,
            src,
            width: !imageFill ? width : void 0
          }
        )
      ]
    }
  );
};

// src/components/Media/VideoMedia/index.tsx
var import_react = require("react");

// src/components/Media/VideoMedia/index.module.css
var VideoMedia_default = {
  video: "VideoMedia_video"
};

// src/components/Media/VideoMedia/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var VideoMedia = (props) => {
  const { onClick, paused, presentation, resource, videoClassName, videoSourceMedia } = props;
  const video = (0, import_react.useRef)(null);
  const isAmbient = (presentation?.video?.playback ?? MEDIA_PRESENTATION_DEFAULTS.video.playback) === "ambient";
  (0, import_react.useEffect)(() => {
    const element = video.current;
    if (!element || !isAmbient || paused === void 0) return;
    if (paused) element.pause();
    else void element.play().catch(() => {
    });
  }, [isAmbient, paused, resource]);
  if (resource && typeof resource === "object") {
    const { durationSeconds, updatedAt, url } = resource;
    if (!url) return null;
    const source = getMediaUrl(url, updatedAt);
    const videoPresentation = presentation?.video;
    const canTransform = isCloudflareVideoEligible({ source, durationSeconds });
    const renderedSource = canTransform ? buildCloudflareVideoURL({ presentation: videoPresentation, source }) : source;
    const poster = canTransform ? buildCloudflareVideoPosterURL({ presentation: videoPresentation, source }) : void 0;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "video",
      {
        ref: video,
        autoPlay: isAmbient && paused !== true,
        className: cn(VideoMedia_default.video, videoClassName),
        controls: !isAmbient,
        "data-media-kind": "video",
        loop: isAmbient,
        muted: isAmbient,
        onClick,
        playsInline: true,
        poster,
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("source", { src: renderedSource, type: "video/mp4", media: videoSourceMedia })
      }
    );
  }
  return null;
};

// src/components/Media/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var includesMimeType = (mimeTypes, mimeType) => typeof mimeType === "string" && mimeTypes.includes(mimeType);
var Media = (props) => {
  const { className, htmlElement = "div", resource } = props;
  const mimeType = typeof resource === "object" ? resource?.mimeType : void 0;
  const renderer = props.src ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ImageMedia, { ...props }) : includesMimeType(MEDIA_RENDERABLE_MIME_TYPES.image, mimeType) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ImageMedia, { ...props }) : includesMimeType(MEDIA_RENDERABLE_MIME_TYPES.video, mimeType) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(VideoMedia, { ...props }) : null;
  const Tag = htmlElement || import_react2.Fragment;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    Tag,
    {
      ...htmlElement !== null ? {
        className
      } : {},
      children: renderer
    }
  );
};

// src/heros/HeaderThemeSync.tsx
var import_react4 = require("react");

// src/providers/HeaderTheme/index.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var HeaderThemeContext = (0, import_react3.createContext)({
  headerTheme: null,
  setHeaderTheme: () => void 0
});
var useHeaderTheme = () => (0, import_react3.use)(HeaderThemeContext);

// src/heros/HeaderThemeSync.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var HeaderThemeSync = ({ theme }) => {
  const { setHeaderTheme } = useHeaderTheme();
  (0, import_react4.useLayoutEffect)(() => {
    setHeaderTheme(theme ?? null);
    return () => setHeaderTheme(null);
  }, [setHeaderTheme, theme]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": "true", "data-header-theme": theme ?? "light", hidden: true });
};

// src/heros/BlogListingHero/index.module.css
var BlogListingHero_default = {
  root: "BlogListingHero_root",
  mediaFrame: "BlogListingHero_mediaFrame",
  image: "BlogListingHero_image",
  scrim: "BlogListingHero_scrim",
  content: "BlogListingHero_content",
  heading: "website-type-heading-1 BlogListingHero_heading",
  description: "BlogListingHero_description"
};

// src/heros/BlogListingHero/index.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var BlogListingHero = ({
  heading,
  description,
  image: image2,
  mobileMedia,
  headerTheme,
  breadcrumb
}) => {
  const desktopMedia = image2 && typeof image2 === "object" ? image2 : mobileMedia;
  const mobileImage = mobileMedia ?? desktopMedia;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "section",
    {
      className: BlogListingHero_default.root,
      "data-hero": "blog-listing",
      "data-website-theme": headerTheme === "dark" ? "inverse" : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HeaderThemeSync, { theme: headerTheme }),
        desktopMedia && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            className: BlogListingHero_default.mediaFrame,
            "data-hero-media-frame": true,
            "aria-hidden": "true",
            style: {
              "--hero-focal-point": `${desktopMedia.focalX ?? 50}% ${desktopMedia.focalY ?? 50}%`,
              "--hero-mobile-focal-point": `${mobileImage?.focalX ?? 50}% ${mobileImage?.focalY ?? 50}%`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                Media,
                {
                  fill: true,
                  priority: true,
                  size: "100vw",
                  resource: desktopMedia,
                  mobileResource: mobileMedia,
                  imgClassName: BlogListingHero_default.image,
                  presentation: { image: { fit: "cover", quality: 85 } }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: BlogListingHero_default.scrim, "data-hero-scrim": true })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: BlogListingHero_default.content, children: [
          breadcrumb,
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { className: BlogListingHero_default.heading, children: heading }),
          description && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: BlogListingHero_default.description, children: description })
        ] })
      ]
    }
  );
};

// output/playwright/settings-hero-consistency/fixture.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var desktop = {
  id: "desktop",
  alt: "Desktop fixture",
  url: "http://127.0.0.1:47711/desktop.png",
  mimeType: "image/png",
  width: 1600,
  height: 900,
  focalX: 30,
  focalY: 50,
  createdAt: "",
  updatedAt: ""
};
var mobile = { ...desktop, id: "mobile", alt: "Mobile fixture", url: "http://127.0.0.1:47711/mobile.png", width: 800, height: 1e3, focalX: 70 };
var renderFixture = (variant) => (0, import_server.renderToStaticMarkup)(
  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    BlogListingHero,
    {
      heading: "Stories from the field",
      description: "Responsive Hero verification using the production component and shared Media renderer.",
      headerTheme: variant === "light" ? "light" : "dark",
      image: variant === "mobile-only" || variant === "text-only" ? null : desktop,
      mobileMedia: variant === "fallback" || variant === "text-only" ? null : mobile
    }
  )
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  renderFixture
});
