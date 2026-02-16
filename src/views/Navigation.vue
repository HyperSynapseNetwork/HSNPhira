<template>
  <div class="container mx-auto px-4 py-24">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('nav.navigation') }}</h1>

    <!-- 官方链接 -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('navigation.official') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          v-for="link in officialLinks"
          :key="link.url"
          class="glass rounded-2xl p-6 hover:scale-105 hover:shadow-2xl transition-all group text-left"
          @click="openLink(link.url)"
        >
          <h3 class="text-xl font-bold text-white mb-2 glow-on-hover">
            {{ link.title }}
          </h3>
          <p class="text-white/60 text-sm break-all">
            {{ link.url }}
          </p>
        </button>
      </div>
    </div>

    <!-- 联机服务器 -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('navigation.multiplayer') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          v-for="link in multiplayerLinks"
          :key="link.url"
          class="glass rounded-2xl p-6 hover:scale-105 hover:shadow-2xl transition-all group text-left"
          @click="openLink(link.url)"
        >
          <h3 class="text-xl font-bold text-white mb-2 glow-on-hover">
            {{ link.title }}
          </h3>
          <p class="text-white/60 text-sm break-all">
            {{ link.url }}
          </p>
        </button>
      </div>
    </div>

    <!-- 社区开源仓库 -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold text-white mb-6">{{ t('navigation.community') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          v-for="link in communityLinks"
          :key="link.url"
          class="glass rounded-2xl p-6 hover:scale-105 hover:shadow-2xl transition-all group text-left"
          @click="openLink(link.url)"
        >
          <h3 class="text-xl font-bold text-white mb-2 glow-on-hover">
            {{ link.title }}
          </h3>
          <p class="text-white/60 text-sm break-all">
            {{ link.url }}
          </p>
        </button>
      </div>
    </div>

    <div class="mt-12 text-center">
      <p class="text-white/60 text-sm">
        {{ t('navigation.tip') }}
        <a href="mailto:nb3502022@outlook.com" class="text-primary glow-on-hover">
          nb3502022@outlook.com
        </a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'

const { t } = useI18nStore()

// 官方链接
const officialLinks = [
  {
    title: t('navigation.phiraOfficialRepo'),
    url: 'https://github.com/login?return_to=https://github.com/TeamFlos/phira/'
  },
  {
    title: t('navigation.phiraOfficialWebsite'),
    url: 'https://phira.moe/'
  },
  {
    title: t('navigation.dmockenPhiraDownload'),
    url: 'https://phira.dmocken.top/'
  },
  {
    title: t('navigation.phiraFaqDocument'),
    url: 'https://docs.qq.com/pdf/DU0FRVHVCd01KdERO'
  }
]

// 联机服务器链接
const multiplayerLinks = [
  {
    title: t('navigation.phiraServerStatus'),
    url: 'https://status.dmocken.top/status/phira'
  },
  {
    title: t('navigation.hsnPhiraServer'),
    url: 'https://phira.htadiy.com/'
  },
  {
    title: t('navigation.funxlinkPhiraPanel'),
    url: 'https://phira.chuzoux.top/'
  },
  {
    title: t('navigation.toyamaPhiraRooms'),
    url: 'https://iphira.danieltoyama.fun/'
  },
  {
    title: t('navigation.autoRoomQuery'),
    url: 'https://phira.dmocken.top/mulity'
  }
]

// 社区开源仓库
const communityLinks = [
  {
    title: t('navigation.hsnPhiraRepo'),
    url: 'https://github.com/HyperSynapseNetwork/HSNPhira'
  },
  {
    title: t('navigation.javaPhiraMp'),
    url: 'https://github.com/lRENyaaa/jphira-mp'
  },
  {
    title: t('navigation.hsnPhiraMp'),
    url: 'https://github.com/HyperSynapseNetwork/phira-mp'
  },
  {
    title: t('navigation.tsPhiraMpPimeng'),
    url: 'https://github.com/Pimeng/tphira-mp'
  },
  {
    title: t('navigation.tsPhiraMpChuzouX'),
    url: 'https://github.com/chuzouX/phira-mp-nodejsver'
  },
  {
    title: t('navigation.pythonPhiraMp'),
    url: 'https://github.com/Evi233/pyphira-mp'
  },
  {
    title: t('navigation.csharpPhiraMp'),
    url: 'https://github.com/NuanRMxi-Lazy-Team/PhiraMpServerCSharp'
  },
  {
    title: t('navigation.goPhiraMp'),
    url: 'https://github.com/Pimeng/gphira-mp'
  }
]

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>
