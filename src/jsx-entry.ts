import { createESFS } from './core';
import { createAdobePathAdapter } from './adobe-adapter';
import { createNativeFacade, enableNativeGate } from './native';

var __esfsFacade: any = createESFS(createAdobePathAdapter());
/* Native calls remain opt-in. The accelerator may adopt an ESPACK-owned
   library, but it never rewires the default Adobe File/Folder methods. */
__esfsFacade['native'] = createNativeFacade();
__esfsFacade['enableNativeGate'] = enableNativeGate;
var __esfsGlobal: any = null;
try {
  if (typeof $ !== 'undefined' && $.global) __esfsGlobal = $.global;
} catch (ignoredGlobal) {}
if (__esfsGlobal) __esfsGlobal['ESFS'] = __esfsFacade;
