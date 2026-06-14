export type ContractTemplateField = {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select";
    required?: boolean;
    placeholder?: string;
    options?: string[];
};

export type ContractTemplate = {
    id: string;
    name: string;
    industry: string;
    contractType: string;
    description: string;
    fields: ContractTemplateField[];
    defaultSections: string[];
    promptTemplate?: string | null;
};

const commonPartyFields: ContractTemplateField[] = [
    { key: "partyA", label: "甲方", type: "text", required: true, placeholder: "请输入甲方名称" },
    { key: "partyB", label: "乙方", type: "text", required: true, placeholder: "请输入乙方名称" },
    { key: "effectiveDate", label: "生效日期", type: "date", required: true },
    { key: "jurisdiction", label: "争议解决地", type: "text", placeholder: "例如：甲方所在地人民法院" },
];

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
    {
        id: "service-agreement",
        name: "服务合同",
        industry: "企业服务",
        contractType: "service",
        description: "适用于软件开发、咨询、设计、运营等服务交付场景。",
        fields: [
            ...commonPartyFields,
            { key: "serviceScope", label: "服务内容", type: "textarea", required: true },
            { key: "servicePeriod", label: "服务周期", type: "text", required: true },
            { key: "fee", label: "服务费用", type: "text", required: true },
            { key: "paymentMethod", label: "付款方式", type: "textarea", required: true },
            { key: "acceptanceCriteria", label: "验收标准", type: "textarea", required: true },
        ],
        defaultSections: ["合同主体", "服务内容", "服务期限", "费用与付款", "验收标准", "知识产权", "保密义务", "违约责任", "争议解决"],
    },
    {
        id: "purchase-agreement",
        name: "采购合同",
        industry: "采购供应",
        contractType: "purchase",
        description: "适用于商品、设备、原材料等采购交易。",
        fields: [
            ...commonPartyFields,
            { key: "goods", label: "采购标的", type: "textarea", required: true },
            { key: "quantity", label: "数量/规格", type: "text", required: true },
            { key: "amount", label: "合同金额", type: "text", required: true },
            { key: "delivery", label: "交付安排", type: "textarea", required: true },
            { key: "qualityStandard", label: "质量标准", type: "textarea", required: true },
        ],
        defaultSections: ["采购标的", "规格与数量", "价格与付款", "交付与验收", "质量保证", "售后服务", "违约责任", "争议解决"],
    },
    {
        id: "sales-agreement",
        name: "销售合同",
        industry: "销售贸易",
        contractType: "sales",
        description: "适用于产品销售、渠道销售及常规贸易。",
        fields: [
            ...commonPartyFields,
            { key: "product", label: "销售产品", type: "textarea", required: true },
            { key: "price", label: "价格", type: "text", required: true },
            { key: "paymentTerm", label: "付款条件", type: "textarea", required: true },
            { key: "deliveryTerm", label: "交货条件", type: "textarea", required: true },
        ],
        defaultSections: ["产品信息", "价格与结算", "订单与交付", "验收与异议", "质量保证", "违约责任", "合同解除", "争议解决"],
    },
    {
        id: "lease-agreement",
        name: "房屋租赁合同",
        industry: "房产租赁",
        contractType: "lease",
        description: "适用于办公、商业或个人房屋租赁。",
        fields: [
            ...commonPartyFields,
            { key: "propertyAddress", label: "房屋地址", type: "text", required: true },
            { key: "leaseTerm", label: "租赁期限", type: "text", required: true },
            { key: "rent", label: "租金", type: "text", required: true },
            { key: "deposit", label: "押金", type: "text", required: true },
            { key: "usage", label: "租赁用途", type: "text", required: true },
        ],
        defaultSections: ["租赁房屋", "租赁期限", "租金与押金", "交付与返还", "使用与维护", "转租限制", "违约责任", "争议解决"],
    },
    {
        id: "labor-contract",
        name: "劳动合同",
        industry: "人力资源",
        contractType: "labor",
        description: "适用于企业与员工建立劳动关系。",
        fields: [
            ...commonPartyFields,
            { key: "position", label: "岗位", type: "text", required: true },
            { key: "workLocation", label: "工作地点", type: "text", required: true },
            { key: "salary", label: "薪酬", type: "text", required: true },
            { key: "probation", label: "试用期", type: "text" },
            { key: "workingHours", label: "工时制度", type: "select", options: ["标准工时", "综合计算工时", "不定时工时"] },
        ],
        defaultSections: ["合同期限", "工作内容与地点", "工作时间", "劳动报酬", "社会保险", "劳动保护", "合同解除", "争议处理"],
    },
    {
        id: "labor-service-contract",
        name: "劳务合同",
        industry: "人力资源",
        contractType: "labor-service",
        description: "适用于非劳动关系的个人服务、临时劳务或项目劳务。",
        fields: [
            ...commonPartyFields,
            { key: "workContent", label: "劳务内容", type: "textarea", required: true },
            { key: "serviceTerm", label: "服务期限", type: "text", required: true },
            { key: "remuneration", label: "劳务报酬", type: "text", required: true },
            { key: "settlement", label: "结算方式", type: "textarea", required: true },
        ],
        defaultSections: ["劳务内容", "服务期限", "报酬与结算", "成果交付", "安全责任", "保密义务", "违约责任", "争议解决"],
    },
    {
        id: "nda",
        name: "保密协议 NDA",
        industry: "通用法务",
        contractType: "nda",
        description: "适用于商务合作、项目沟通、技术交流前的保密安排。",
        fields: [
            ...commonPartyFields,
            { key: "confidentialInfo", label: "保密信息范围", type: "textarea", required: true },
            { key: "purpose", label: "披露目的", type: "textarea", required: true },
            { key: "confidentialPeriod", label: "保密期限", type: "text", required: true },
            { key: "penalty", label: "违约责任", type: "textarea" },
        ],
        defaultSections: ["保密信息范围", "使用目的", "保密义务", "例外情形", "资料返还与销毁", "违约责任", "协议期限", "争议解决"],
    },
    {
        id: "cooperation-agreement",
        name: "合作协议",
        industry: "商务合作",
        contractType: "cooperation",
        description: "适用于联合运营、项目合作、资源互换等业务合作。",
        fields: [
            ...commonPartyFields,
            { key: "cooperationGoal", label: "合作目标", type: "textarea", required: true },
            { key: "responsibilities", label: "双方职责", type: "textarea", required: true },
            { key: "profitSharing", label: "收益分配", type: "textarea", required: true },
            { key: "term", label: "合作期限", type: "text", required: true },
        ],
        defaultSections: ["合作目标", "合作内容", "双方权利义务", "费用与收益分配", "知识产权", "保密义务", "合作终止", "违约责任", "争议解决"],
    },
];

export function getContractTemplate(templateId?: string | null) {
    return CONTRACT_TEMPLATES.find((template) => template.id === templateId) ?? CONTRACT_TEMPLATES[0];
}
