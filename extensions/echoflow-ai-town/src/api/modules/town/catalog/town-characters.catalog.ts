export type TownCharacterCatalogItem = {
    name: string;
    role: string;
    personality: string;
    relationship: number;
    status: string;
};

export const TOWN_CHARACTER_CATALOG: TownCharacterCatalogItem[] = [
    { name: "小满", role: "餐馆帮手", personality: "乐观、勤快，喜欢尝试新菜谱", relationship: 32, status: "准备午餐" },
    { name: "阿泽", role: "餐馆老板", personality: "可靠、热情，擅长规划经营", relationship: 28, status: "清点库存" },
    { name: "花音", role: "花店店主", personality: "温柔、细致，熟悉居民喜好", relationship: 24, status: "整理花束" },
    { name: "旅人洛", role: "神秘旅人", personality: "友善、神秘，带来远方传闻", relationship: 18, status: "路过广场" },
];
