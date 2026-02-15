<template>
  <div class="container mx-auto px-4 py-24">
    <h1 class="text-4xl font-bold text-white text-center mb-12">{{ t('nav.navigation') }}</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <button
        v-for="link in links"
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
import { eventBus } from '@/utils/eventBus'

const { t } = useI18nStore()

const links = [
  {
    title: 'Phira官方仓库',
    url: 'https://github.com/login?return_to=https://github.com/TeamFlos/phira/'
  },
  {
    title: 'Phira官网',
    url: 'https://phira.moe/'
  },
  {
    title: 'Phira多人游戏服务器状态查询',
    url: 'https://status.dmocken.top/status/phira'
  },
  {
    title: 'Dmocken的Phira下载站',
    url: 'https://phira.dmocken.top/'
  },
  {
    title: 'HyperSynapse Network Phira多人游戏服务器官网',
    url: 'https://phira.htadiy.com/'
  },
  {
    title: 'FunXLink Studio Phira 联机服务器 Web 监控面板',
    url: 'https://phira.chuzoux.top/'
  },
  {
    title: 'PyPhira 房间查询',
    url: 'http://qd.phira.huqi-studio.top:50253/'
  },
  {
    title: '户山兔兔的phira服务器房间列表查询',
    url: 'https://iphira.danieltoyama.fun/'
  },
  {
    title: 'HSNPhira官方仓库',
    url: 'https://github.com/HyperSynapseNetwork/HSNPhira'
  },
  {
    title: 'tphira官方仓库',
    url: 'https://github.com/Pimeng/tphira-mp/'
  },
  {
    title: 'pyphira官方仓库',
    url: 'https://github.com/Evi233/pyphira-mp'
  },
  {
    title: 'cpp phira-mp官方仓库',
    url: 'https://github.com/HyperSynapseNetwork/cpp-phira-mp'
  },
  {
    title: 'Phira常见问题自助文档',
    url: 'https://docs.qq.com/pdf/DU0FRVHVCd01KdERO'
  }
]

function openLink(url: string) {
  eventBus.emit('open-link', url)
}
</script>
