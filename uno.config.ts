import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  shortcuts: {
    'card': 'bg-white rounded-[6px] border-1 border-[#e1e6ed]',
    'b-ellipsis': 'overflow-hidden whitespace-nowrap text-ellipsis',
    'page-title': 'text-[18px] font-600 text-[#18212e]',
    'b-opt': 'text-[#378eef] cursor-pointer hover:text-[#5fa4f2] text-[13px]',
  },
})
