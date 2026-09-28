import { createESFS } from './core';
import { createAdobePathAdapter } from './adobe-adapter';

var __esfsFacade = createESFS(createAdobePathAdapter());
var __esfsGlobal: any = null;
try {
  if (typeof $ !== 'undefined' && $.global) __esfsGlobal = $.global;
} catch (ignoredGlobal) {}
if (__esfsGlobal) __esfsGlobal['ESFS'] = __esfsFacade;
