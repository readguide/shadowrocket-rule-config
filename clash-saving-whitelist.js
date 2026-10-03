// Clash Verge / Mihomo enhancement script: saving + whitelist.
// Public: contains no subscription URL or credential. Installed per airport profile.
function main(config, profileName) {
  // Defense in depth: the local installer additionally matches private subscription URL identities.
  // "钱" is the verified Clash display alias of Shadowrocket's "钱-1".
  if (!new Set(['吹雪云-0','搅局者','钱','钱-1','良心云-1']).has(profileName)) return config;
  const raw = (config.proxies || []).filter(p => p && typeof p.name === 'string').map(p => p.name);
  const names = raw.filter(n => !/^(?:STATUS=|剩余流量|套餐到期|距离下次重置|到期时间|有效期|自动选择|故障转移|DIRECT|REJECT)/i.test(n));
  if (!names.length) return config;
  const unique = a => [...new Set(a)];
  const regions = [
    ['香港节点', /🇭🇰|香港|Hong|\bHK\b|HKT/i],
    ['美国节点', /🇺🇸|美国|洛杉矶|西雅图|America|USA|USLA/i],
    ['新加坡节点', /🇸🇬|新加坡|狮城|Singapore|Sing|\bSG\b/i],
    ['日本节点', /🇯🇵|日本|东京|大阪|Japan|Tokyo|\bJP\b/i],
    ['台湾节点', /🇹🇼|🇨🇳台湾|台湾|台灣|台北|Taiwan|Taipei|\bTW\b/i],
    ['韩国节点', /🇰🇷|韩国|韓國|首尔|Korea|\bKR\b/i]
  ];
  const multiplier = /(?:^|[^\d.])0\.(?:0[1-9]\d*|[1-9]\d*)(?=$|[^\d.])/;
  const ultra = /(?:^|[^\d.])0\.0[1-9]\d*(?=$|[^\d.])/;
  const low = /(?:^|[^\d.])0\.[1-9]\d*(?=$|[^\d.])/;
  const excluded = n => /(?:剩余|到期|套餐|流量|重置|说明|官网|联系|订阅|公告)/i.test(n);
  const groups=[];
  const opts={url:'http://www.gstatic.com/generate_204',interval:600};
  const create=(name,type,members) => {
    const proxies=unique(members).filter(Boolean);
    if (!proxies.length) return false;
    groups.push({name,type,proxies,...opts}); return true;
  };
  const regionNodes={};
  for (const [name,re] of regions) regionNodes[name]=names.filter(n=>!excluded(n)&&re.test(n));
  const regionNames=regions.map(x=>x[0]).filter(n=>regionNodes[n].length);
  const remaining=names.filter(n=>!excluded(n)&&!regions.some(([k])=>regionNodes[k].includes(n)));
  const ordered=unique([...regions.flatMap(([k])=>regionNodes[k]),...remaining]);
  create('PROXY','fallback',ordered.length?ordered:names);
  const services=['AI','Emby','YouTube','Netflix','Disney+','Max','TikTok','Spotify','Telegram','Twitter','Facebook','PayPal','Amazon','苹果服务','谷歌服务','微软服务','哔哩哔哩','游戏平台'];
  const lowGroups=[
    ['超低倍率 0.01-0.1',ultra],['低倍率 0.1-1.0',low],['低倍率全 0.01-1.0',multiplier]
  ];
  const foundLow=lowGroups.filter(([_,re])=>names.some(n=>!excluded(n)&&re.test(n))).map(x=>x[0]);
  const defaultGroup=foundLow.includes('超低倍率 0.01-0.1')?'超低倍率 0.01-0.1':'PROXY';
  for(const name of services){
    let first=name==='AI'&&regionNames.includes('新加坡节点')?'新加坡节点':
      ['YouTube','Telegram','Emby'].includes(name)?defaultGroup:
      ['Emby','Spotify','PayPal','Amazon','苹果服务','微软服务','哔哩哔哩','游戏平台'].includes(name)?'DIRECT':'PROXY';
    let members=[first,...(first==='DIRECT'?['DIRECT']:[]),'PROXY',...foundLow,...regionNames];
    if(name==='哔哩哔哩')members=members.filter(n=>!regionNames.includes(n)||['香港节点','台湾节点'].includes(n));
    create(name,'fallback',members);
  }
  for(const [name] of regions)if(regionNodes[name].length)create(name,'fallback',regionNodes[name]);
  for(const [name,re] of lowGroups){const nodes=names.filter(n=>!excluded(n)&&re.test(n));if(nodes.length)create(name,'url-test',nodes);}
  const known=new Set(groups.map(g=>g.name));
  // A missing region still leaves AI bound to an explicit PROXY fallback.
  const ruleProviders={}; const rules=[];
  const b='https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/';
  const add=(key,path,policy,format='text')=>{
    if(!known.has(policy)&&!['DIRECT','REJECT'].includes(policy))return;
    ruleProviders[key]={type:'http',behavior:'classical',format,url:b+path+'/'+path+'.list',path:'./ruleset/sr-'+key+'.list',interval:86400};
    rules.push('RULE-SET,'+key+','+policy);
  };
  rules.push('DOMAIN,hxd.as174.de,Emby','DOMAIN,pro.emby.moe,Emby','DOMAIN,cf.xmsl.org,Emby');
  add('sr-emby','Emby','Emby');
  ruleProviders['sr-ai']={type:'http',behavior:'classical',format:'text',url:'https://raw.githubusercontent.com/iab0x00/ProxyRules/main/Rule/AI.txt',path:'./ruleset/sr-ai.list',interval:86400};
  rules.push('RULE-SET,sr-ai,AI');
  for(const [key,path,policy] of [
    ['youtube','YouTube','YouTube'],['netflix','Netflix','Netflix'],['disney','Disney','Disney+'],
    ['hbo','HBO','Max'],['spotify','Spotify','Spotify'],['telegram','Telegram','Telegram'],
    ['paypal','PayPal','PayPal'],['twitter','Twitter','Twitter'],['facebook','Facebook','Facebook'],
    ['amazon','Amazon','Amazon'],['sony','Sony','游戏平台'],['nintendo','Nintendo','游戏平台'],
    ['epic','Epic','游戏平台'],['steamcn','SteamCN','游戏平台'],['steam','Steam','游戏平台'],
    ['game','Game','游戏平台'],['github','GitHub','PROXY'],['microsoft','Microsoft','微软服务'],
    ['google','Google','谷歌服务'],['apple','Apple','苹果服务'],['bilibili','BiliBili','哔哩哔哩'],
    ['netease','NetEaseMusic','DIRECT'],['baidu','Baidu','DIRECT'],['douban','DouBan','DIRECT'],
    ['wechat','WeChat','DIRECT'],['sina','Sina','DIRECT'],['zhihu','Zhihu','DIRECT'],
    ['xiaohongshu','XiaoHongShu','DIRECT'],['douyin','DouYin','DIRECT'],['tiktok','TikTok','TikTok']
  ])add('sr-'+key,path,policy);
  rules.push('DOMAIN-SUFFIX,litix.io,Max','DOMAIN-SUFFIX,discomax.com,Max','DOMAIN-SUFFIX,brightline.tv,Max');
  // Johnshall top500 is a compact partial whitelist, not the full author configuration.
  ruleProviders['sr-top500-direct']={type:'http',behavior:'domain',format:'text',url:'https://raw.githubusercontent.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever/build/factory/resultant/top500_direct.list',path:'./ruleset/sr-top500-direct.list',interval:86400};
  rules.push('RULE-SET,sr-top500-direct,DIRECT');
  add('sr-china','China','DIRECT');add('sr-lan','Lan','DIRECT');
  rules.push('GEOIP,CN,DIRECT','MATCH,PROXY');
  config['proxy-groups']=[...groups,...(config['proxy-groups']||[]).filter(g=>!known.has(g.name))];
  config['rule-providers']={...(config['rule-providers']||{}),...ruleProviders};
  config.rules=rules;
  return config;
}
