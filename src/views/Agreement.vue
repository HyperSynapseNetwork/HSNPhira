<template>
  <div class="container mx-auto px-4 py-24 max-w-4xl">
    <div class="glass rounded-3xl p-8">
      <h1 class="text-3xl font-bold text-white mb-6 text-center">
        {{ t('agreement.pageTitle') }}
      </h1>

      <div class="text-white/90 space-y-6 leading-relaxed">
        <div>
          <p class="text-sm text-white/60">{{ t('agreement.effectiveDate') }}：{{ t('agreement.effectiveDateText') }}</p>
          <p class="text-sm text-white/60">{{ t('agreement.lastUpdate') }}：{{ t('agreement.lastUpdateDate') }}</p>
        </div>

        <div class="mt-4 p-4 glass-dark rounded-xl">
          <p class="text-white/80">{{ t('agreement.disclaimer') }}</p>
        </div>

        <section>
          <h2 class="text-xl font-bold mb-3">{{ t('agreement.section1') }}</h2>
          <h3 class="text-lg font-semibold mb-2">{{ t('agreement.section1_1') }}</h3>
          <p class="mb-2">
            <strong>{{ t('agreement.platformDefinition') }}</strong>{{ t('agreement.platformDefinitionText') }}
          </p>
          <p class="mb-2">
            <strong>{{ t('agreement.userDefinition') }}</strong>{{ t('agreement.userDefinitionText') }}
          </p>
          <h3 class="text-lg font-semibold mb-2 mt-4">{{ t('agreement.section1_2') }}</h3>
          <p>{{ t('agreement.serviceContent') }}</p>
        </section>

        <section>
          <h2 class="text-xl font-bold mb-3">{{ t('agreement.section2') }}</h2>
          <h3 class="text-lg font-semibold mb-2">{{ t('agreement.section2_1') }}</h3>
          <p>{{ t('agreement.accountSecurity') }}</p>

          <h3 class="text-lg font-semibold mb-2 mt-4">{{ t('agreement.section2_2') }}</h3>
          <p class="mb-2">{{ t('agreement.behaviorRules') }}</p>
          <ul class="list-disc list-inside space-y-1 ml-4">
            <li>{{ t('agreement.prohibitedItem1') }}</li>
            <li>{{ t('agreement.prohibitedItem2') }}</li>
            <li>{{ t('agreement.prohibitedItem3') }}</li>
          </ul>
          <p class="mt-2">{{ t('agreement.violationConsequences') }}</p>
        </section>

        <section>
          <h2 class="text-xl font-bold mb-3">{{ t('agreement.section3') }}</h2>
          <h3 class="text-lg font-semibold mb-2">{{ t('agreement.section3_1') }}</h3>
          <p class="mb-2">{{ t('agreement.technicalRisk') }}</p>
          <ul class="list-disc list-inside space-y-1 ml-4">
            <li><strong>{{ t('agreement.forceMajeure') }}</strong>{{ t('agreement.forceMajeureText') }}</li>
            <li><strong>{{ t('agreement.necessaryMaintenance') }}</strong>{{ t('agreement.necessaryMaintenanceText') }}</li>
            <li><strong>{{ t('agreement.userCauses') }}</strong>{{ t('agreement.userCausesText') }}</li>
          </ul>

          <h3 class="text-lg font-semibold mb-2 mt-4">{{ t('agreement.section3_2') }}</h3>
          <ul class="list-disc list-inside space-y-1 ml-4">
            <li>{{ t('agreement.riskItem1') }}</li>
            <li>{{ t('agreement.riskItem2') }}</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold mb-3">{{ t('agreement.section4') }}</h2>
          <h3 class="text-lg font-semibold mb-2">{{ t('agreement.section4_1') }}</h3>
          <p class="mb-2"><strong>{{ t('agreement.collectionScope') }}</strong>{{ t('agreement.collectionScopeText') }}</p>
          <p class="mb-2"><strong>{{ t('agreement.usagePurpose') }}</strong>{{ t('agreement.usagePurposeText') }}</p>
          <p class="mb-2"><strong>{{ t('agreement.crossBorderTransfer') }}</strong>{{ t('agreement.crossBorderTransferText') }}</p>
        </section>

        <div class="mt-8 p-4 glass-dark rounded-xl">
          <p class="text-center text-sm">
            {{ t('agreement.finalNote') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'

const { t } = useI18nStore()
</script>
