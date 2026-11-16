import type { Plugin } from 'payload'
import { translations } from './collections/translations'
import { translationSearch } from './collections/translationSearch'
import { translationUsage } from './collections/translationUsage'
import { createTranslationRuntime, TRANSLATION_QUEUE, type TranslationOptions } from './task'
import { createCollectionTranslationHooks, createGlobalTranslationHook } from './hooks'
import { getTranslationRule } from './rules'
import { enqueueFrontendDictionary } from './dictionary'

export const translationPlugin =
  (options: TranslationOptions = {}): Plugin =>
  (config) => {
    const runtime = createTranslationRuntime(options)
    return {
      ...config,
      custom: { ...config.custom, translationRuntime: () => runtime },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        await enqueueFrontendDictionary(payload, runtime)
      },
      collections: [
        ...(config.collections ?? []).map((collection) => {
          if (!getTranslationRule(collection.slug)) return collection
          const hooks = createCollectionTranslationHooks(
            collection.slug,
            Boolean(typeof collection.versions === 'object' && collection.versions.drafts),
            runtime,
          )
          // Products owns capture and final consumption of its public transition.
          if (collection.slug === 'products')
            return {
              ...collection,
              hooks: {
                ...collection.hooks,
                afterDelete: [...(collection.hooks?.afterDelete ?? []), hooks.afterDelete],
              },
            }
          return {
            ...collection,
            hooks: {
              ...collection.hooks,
              beforeChange: [...(collection.hooks?.beforeChange ?? []), hooks.beforeChange],
              afterChange: [...(collection.hooks?.afterChange ?? []), hooks.afterChange],
              afterDelete: [...(collection.hooks?.afterDelete ?? []), hooks.afterDelete],
            },
          }
        }),
        translations,
        translationSearch,
      ],
      globals: [
        ...(config.globals ?? []).map((global) =>
          getTranslationRule(`global:${global.slug}`)
            ? {
                ...global,
                hooks: {
                  ...global.hooks,
                  afterChange: [
                    ...(global.hooks?.afterChange ?? []),
                    createGlobalTranslationHook(`global:${global.slug}`, runtime),
                  ],
                },
              }
            : global,
        ),
        translationUsage,
      ],
      jobs: {
        ...config.jobs,
        processingOrder: async (args) => {
          const configured = config.jobs?.processingOrder
          const order =
            typeof configured === 'function'
              ? await configured(args)
              : configured && typeof configured === 'object' && !Array.isArray(configured)
                ? (configured.queues[args.queue ?? 'default'] ?? configured.default ?? 'createdAt')
                : (configured ?? 'createdAt')
          // Native/saved jobs without metadata keep their FIFO precedence. New
          // translation work sorts by update, publication, then first backfill.
          return args.allQueues || args.queue === TRANSLATION_QUEUE
            ? ['meta.translationPriority', ...(Array.isArray(order) ? order : [order])]
            : order
        },
        tasks: [...(config.jobs?.tasks ?? []), ...runtime.tasks],
      },
    }
  }
