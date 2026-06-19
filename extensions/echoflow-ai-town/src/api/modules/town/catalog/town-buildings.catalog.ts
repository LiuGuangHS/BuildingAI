import type { TownWorldState } from "../../../db/entities";

export type TownBuildingCatalogItem = TownWorldState["buildings"][number] & {
    reserved?: boolean;
    experimental?: boolean;
};

export const TOWN_BUILDING_CATALOG: TownBuildingCatalogItem[] = [
    { id: "restaurant", name: "暖光餐馆", level: 1, status: "可经营", effect: "提高经营收入", maxLevel: 5 },
    { id: "florist", name: "风铃花店", level: 1, status: "可拜访", effect: "提高拜访与装饰声望", maxLevel: 5 },
    { id: "square", name: "中央广场", level: 1, status: "可探索", effect: "提高探索奖励", maxLevel: 5 },
];

export const TOWN_INITIAL_AREAS = ["中央广场", "暖光餐馆", "花店街角"];

export function createDefaultTownBuildings() {
    return TOWN_BUILDING_CATALOG.map((building) => ({ ...building }));
}
