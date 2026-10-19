import "i18next";
import type { bundledEnResources } from "./bundledEn";
import type { DEFAULT_NS } from "./namespaces";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: typeof DEFAULT_NS;
        resources: typeof bundledEnResources;
    }
}
