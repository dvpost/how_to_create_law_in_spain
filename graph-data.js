window.LAW_GRAPH = {
  "schema": "participants-procedures-v7",
  "mainPath": [
    "initiative",
    "entry",
    "admission",
    "discussion",
    "approval",
    "senate",
    "final",
    "king",
    "publication"
  ],
  "layout": {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.layering.strategy": "LONGEST_PATH_SOURCE",
    "elk.spacing.nodeNode": "50",
    "elk.layered.spacing.nodeNodeBetweenLayers": "75",
    "elk.layered.spacing.edgeNodeBetweenLayers": "25",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "18",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.thoroughness": "20",
    "elk.randomSeed": "1"
  },
  "edges": [
    {
      "id": "initiative-entry",
      "source": "initiative",
      "target": "entry",
      "kind": "flow"
    },
    {
      "id": "entry-admission",
      "source": "entry",
      "target": "admission",
      "kind": "flow"
    },
    {
      "id": "admission-discussion",
      "source": "admission",
      "target": "discussion",
      "kind": "flow"
    },
    {
      "id": "discussion-approval",
      "source": "discussion",
      "target": "approval",
      "kind": "flow"
    },
    {
      "id": "approval-senate",
      "source": "approval",
      "target": "senate",
      "kind": "flow"
    },
    {
      "id": "senate-final",
      "source": "senate",
      "target": "final",
      "kind": "flow",
      "label": "Без вето / изменений",
      "ref": "010"
    },
    {
      "id": "final-king",
      "source": "final",
      "target": "king",
      "kind": "flow"
    },
    {
      "id": "king-publication",
      "source": "king",
      "target": "publication",
      "kind": "flow"
    },
    {
      "id": "senate-return",
      "source": "senate",
      "target": "return",
      "kind": "return",
      "label": "Поправки / вето",
      "ref": "010"
    },
    {
      "id": "return-final",
      "source": "return",
      "target": "final",
      "kind": "return",
      "label": "После решения Конгресса",
      "ref": "010"
    },
    {
      "id": "commission-return",
      "source": "approval",
      "target": "discussion",
      "kind": "return",
      "label": "Согласованная редакция",
      "ref": "007",
      "organicLabel": "Нет абсолютного большинства",
      "organicRef": "009",
      "sourceWhenExpanded": {
        "approval": "congress-plenary"
      },
      "targetWhenExpanded": {
        "discussion": "congress-commission"
      },
      "feedback": true
    }
  ],
  "expansions": {
    "initiative": {
      "nodes": [
        "government-source",
        "congress-source",
        "senate-source",
        "autonomy-source",
        "ilp-source"
      ],
      "edges": [
        {
          "id": "initiative>government-source",
          "source": "initiative",
          "target": "government-source",
          "kind": "membership"
        },
        {
          "id": "initiative>congress-source",
          "source": "initiative",
          "target": "congress-source",
          "kind": "membership"
        },
        {
          "id": "initiative>senate-source",
          "source": "initiative",
          "target": "senate-source",
          "kind": "membership"
        },
        {
          "id": "initiative>autonomy-source",
          "source": "initiative",
          "target": "autonomy-source",
          "kind": "membership"
        },
        {
          "id": "initiative>ilp-source",
          "source": "initiative",
          "target": "ilp-source",
          "kind": "membership"
        },
        {
          "id": "government-source-entry",
          "source": "government-source",
          "target": "entry",
          "kind": "collapsed"
        },
        {
          "id": "congress-source-entry",
          "source": "congress-source",
          "target": "entry",
          "kind": "collapsed"
        },
        {
          "id": "senate-source-entry",
          "source": "senate-source",
          "target": "entry",
          "kind": "collapsed"
        },
        {
          "id": "autonomy-source-entry",
          "source": "autonomy-source",
          "target": "entry",
          "kind": "collapsed"
        },
        {
          "id": "ilp-source-entry",
          "source": "ilp-source",
          "target": "entry",
          "kind": "collapsed",
          "mode": "ordinary"
        }
      ],
      "removeEdges": [
        "initiative-entry"
      ],
      "description": "Пять источников. Раскрытие источника показывает заявителей и путь к Конгрессу."
    },
    "government-source": {
      "nodes": [
        "government-approval",
        "government-send"
      ],
      "edges": [
        {
          "id": "government-source>government-approval",
          "source": "government-source",
          "target": "government-approval",
          "kind": "flow",
          "ref": "002"
        },
        {
          "id": "government-approval>government-send",
          "source": "government-approval",
          "target": "government-send",
          "kind": "flow",
          "ref": "002"
        },
        {
          "id": "government-send>entry",
          "source": "government-send",
          "target": "entry",
          "kind": "flow",
          "ref": "002"
        }
      ],
      "removeEdges": [
        "government-source-entry"
      ],
      "description": "Действия до внесения правительственного проекта в Конгресс."
    },
    "congress-source": {
      "nodes": [
        "congress-deputies",
        "congress-group"
      ],
      "edges": [
        {
          "id": "congress-source>congress-deputies",
          "source": "congress-source",
          "target": "congress-deputies",
          "kind": "membership"
        },
        {
          "id": "congress-source>congress-group",
          "source": "congress-source",
          "target": "congress-group",
          "kind": "membership"
        },
        {
          "id": "congress-deputies>entry",
          "source": "congress-deputies",
          "target": "entry",
          "kind": "flow",
          "ref": "003"
        },
        {
          "id": "congress-group>entry",
          "source": "congress-group",
          "target": "entry",
          "kind": "flow",
          "ref": "003"
        }
      ],
      "removeEdges": [
        "congress-source-entry"
      ],
      "description": "Два альтернативных заявителя. Требования к ним — в описании карточки."
    },
    "senate-source": {
      "nodes": [
        "senators-25",
        "senate-group",
        "senate-submit",
        "senate-mesa",
        "senate-budget",
        "senate-toma",
        "senate-send",
        "senate-not-taken",
        "senate-commissions"
      ],
      "edges": [
        {
          "id": "senate-source>senators-25",
          "source": "senate-source",
          "target": "senators-25",
          "kind": "membership"
        },
        {
          "id": "senate-source>senate-group",
          "source": "senate-source",
          "target": "senate-group",
          "kind": "membership"
        },
        {
          "id": "senate-budget>senate-toma",
          "source": "senate-budget",
          "target": "senate-toma",
          "kind": "flow",
          "label": "После предусмотренных условий",
          "ref": "004"
        },
        {
          "id": "senate-toma>senate-send",
          "source": "senate-toma",
          "target": "senate-send",
          "kind": "flow",
          "label": "Да",
          "ref": "004"
        },
        {
          "id": "senate-toma>senate-not-taken",
          "source": "senate-toma",
          "target": "senate-not-taken",
          "kind": "flow",
          "label": "Нет",
          "ref": "004"
        },
        {
          "id": "senate-send>entry",
          "source": "senate-send",
          "target": "entry",
          "kind": "flow",
          "label": "Без повторной toma в Конгрессе",
          "ref": "003"
        },
        {
          "id": "senators-25>senate-submit",
          "source": "senators-25",
          "target": "senate-submit",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-group>senate-submit",
          "source": "senate-group",
          "target": "senate-submit",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-submit>senate-mesa",
          "source": "senate-submit",
          "target": "senate-mesa",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-submit>senate-budget",
          "source": "senate-submit",
          "target": "senate-budget",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-mesa>senate-toma",
          "source": "senate-mesa",
          "target": "senate-toma",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-source>senate-commissions",
          "source": "senate-source",
          "target": "senate-commissions",
          "kind": "membership"
        },
        {
          "id": "senate-commissions>senate-mesa",
          "source": "senate-commissions",
          "target": "senate-mesa",
          "kind": "flow",
          "ref": "004"
        },
        {
          "id": "senate-commissions>senate-budget",
          "source": "senate-commissions",
          "target": "senate-budget",
          "kind": "flow",
          "ref": "004"
        }
      ],
      "removeEdges": [
        "senate-source-entry"
      ],
      "description": "Сенаторские заявители и общая карточка двух специальных комиссий → процедура Сената → общий узел Конгресса. Требования и неуточнённые подписи комиссий читаются в описании карточки."
    },
    "autonomy-source": {
      "nodes": [
        "autonomy-direct",
        "autonomy-request"
      ],
      "edges": [
        {
          "id": "autonomy-source>autonomy-direct",
          "source": "autonomy-source",
          "target": "autonomy-direct",
          "kind": "flow",
          "label": "Направить предложение",
          "ref": "001"
        },
        {
          "id": "autonomy-source>autonomy-request",
          "source": "autonomy-source",
          "target": "autonomy-request",
          "kind": "flow",
          "label": "Либо обратиться с просьбой",
          "ref": "001"
        },
        {
          "id": "autonomy-direct>entry",
          "source": "autonomy-direct",
          "target": "entry",
          "kind": "flow",
          "ref": "001"
        },
        {
          "id": "autonomy-request>government-source",
          "source": "autonomy-request",
          "target": "government-source",
          "kind": "flow",
          "label": "Если Правительство принимает проект",
          "ref": "001"
        }
      ],
      "removeEdges": [
        "autonomy-source-entry"
      ],
      "description": "Два предусмотренных Конституцией способа. Просьба не равна уже принятому правительственному проекту."
    },
    "ilp-source": {
      "nodes": [
        "ilp-promoters",
        "ilp-submit",
        "ilp-admit",
        "ilp-notice",
        "ilp-signatures",
        "ilp-check",
        "ilp-parliament",
        "ilp-refused",
        "ilp-blocked"
      ],
      "edges": [
        {
          "id": "ilp-source>ilp-promoters",
          "source": "ilp-source",
          "target": "ilp-promoters",
          "kind": "membership"
        },
        {
          "id": "ilp-promoters>ilp-submit",
          "source": "ilp-promoters",
          "target": "ilp-submit",
          "kind": "flow",
          "ref": "005"
        },
        {
          "id": "ilp-submit>ilp-admit",
          "source": "ilp-submit",
          "target": "ilp-admit",
          "kind": "flow",
          "ref": "005"
        },
        {
          "id": "ilp-admit>ilp-notice",
          "source": "ilp-admit",
          "target": "ilp-notice",
          "kind": "flow",
          "label": "Допущено",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-admit>ilp-submit",
          "source": "ilp-admit",
          "target": "ilp-submit",
          "kind": "return",
          "label": "Исправимый дефект",
          "ref": "005",
          "feedback": true
        },
        {
          "id": "ilp-admit>ilp-refused",
          "source": "ilp-admit",
          "target": "ilp-refused",
          "kind": "flow",
          "label": "Отказ",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-notice>ilp-signatures",
          "source": "ilp-notice",
          "target": "ilp-signatures",
          "kind": "flow",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-signatures>ilp-check",
          "source": "ilp-signatures",
          "target": "ilp-check",
          "kind": "flow",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-check>ilp-parliament",
          "source": "ilp-check",
          "target": "ilp-parliament",
          "kind": "flow",
          "label": "Подтверждено нужное число",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-parliament>entry",
          "source": "ilp-parliament",
          "target": "entry",
          "kind": "flow",
          "ref": "005",
          "mode": "ordinary"
        },
        {
          "id": "ilp-admit>ilp-blocked",
          "source": "ilp-admit",
          "target": "ilp-blocked",
          "kind": "flow",
          "label": "Органический предмет",
          "ref": "020",
          "mode": "organic"
        }
      ],
      "removeEdges": [
        "ilp-source-entry"
      ],
      "description": "Один маршрут через организаторов: подача документов, предварительный допуск, сбор подписей, проверка и парламентская процедура. Подписанты раскрываются у этапа сбора подписей."
    },
    "admission": {
      "nodes": [
        "congress-mesa",
        "congress-law-type",
        "congress-ordinary-type",
        "congress-organic-type",
        "congress-toma-needed",
        "congress-budget",
        "congress-toma",
        "congress-not-taken"
      ],
      "edges": [
        {
          "id": "admission>congress-mesa",
          "source": "admission",
          "target": "congress-mesa",
          "kind": "flow",
          "ref": "006"
        },
        {
          "id": "congress-toma-needed>discussion",
          "source": "congress-toma-needed",
          "target": "discussion",
          "kind": "flow",
          "label": "Проект Правительства / из Сената",
          "ref": "003"
        },
        {
          "id": "congress-toma-needed>congress-budget",
          "source": "congress-toma-needed",
          "target": "congress-budget",
          "kind": "flow",
          "label": "Конгресс / автономия / ILP",
          "ref": "003"
        },
        {
          "id": "congress-budget>congress-toma",
          "source": "congress-budget",
          "target": "congress-toma",
          "kind": "flow",
          "ref": "006"
        },
        {
          "id": "congress-toma>discussion",
          "source": "congress-toma",
          "target": "discussion",
          "kind": "flow",
          "label": "Да",
          "ref": "003"
        },
        {
          "id": "congress-toma>congress-not-taken",
          "source": "congress-toma",
          "target": "congress-not-taken",
          "kind": "flow",
          "label": "Нет",
          "ref": "003"
        },
        {
          "id": "mesa-type",
          "source": "congress-mesa",
          "target": "congress-law-type",
          "kind": "flow",
          "ref": "020",
          "label": "При квалификации типа"
        },
        {
          "id": "type-ordinary",
          "source": "congress-law-type",
          "target": "congress-ordinary-type",
          "kind": "flow",
          "label": "Нет",
          "ref": "020",
          "mode": "ordinary"
        },
        {
          "id": "type-organic",
          "source": "congress-law-type",
          "target": "congress-organic-type",
          "kind": "flow",
          "label": "Да · квалификация Mesa",
          "ref": "020",
          "mode": "organic"
        },
        {
          "id": "ordinary-toma",
          "source": "congress-ordinary-type",
          "target": "congress-toma-needed",
          "kind": "flow",
          "ref": "020",
          "mode": "ordinary"
        },
        {
          "id": "organic-toma",
          "source": "congress-organic-type",
          "target": "congress-toma-needed",
          "kind": "flow",
          "ref": "020",
          "mode": "organic"
        },
        {
          "id": "mesa-type-not-yet",
          "source": "congress-mesa",
          "target": "congress-toma-needed",
          "kind": "flow",
          "label": "Вопрос ещё не поднят",
          "ref": "020"
        }
      ],
      "removeEdges": [
        "admission-discussion"
      ],
      "description": "Проверка Mesa; разные правила начала по происхождению текста. Toma — принять к рассмотрению, не принять закон."
    },
    "discussion": {
      "nodes": [
        "reading-choice",
        "single-reading",
        "congress-amendments",
        "whole-debate",
        "government-returned",
        "alternative-text",
        "congress-ponencia",
        "congress-commission"
      ],
      "edges": [
        {
          "id": "discussion>reading-choice",
          "source": "discussion",
          "target": "reading-choice",
          "kind": "flow",
          "ref": "008"
        },
        {
          "id": "reading-choice>single-reading",
          "source": "reading-choice",
          "target": "single-reading",
          "kind": "flow",
          "label": "Да",
          "ref": "008"
        },
        {
          "id": "single-reading>senate",
          "source": "single-reading",
          "target": "senate",
          "kind": "flow",
          "label": "Текст одобрен",
          "ref": "008"
        },
        {
          "id": "reading-choice>congress-amendments",
          "source": "reading-choice",
          "target": "congress-amendments",
          "kind": "flow",
          "label": "Нет",
          "ref": "008"
        },
        {
          "id": "congress-amendments>congress-ponencia",
          "source": "congress-amendments",
          "target": "congress-ponencia",
          "kind": "flow",
          "label": "Без debate de totalidad",
          "ref": "007"
        },
        {
          "id": "congress-amendments>whole-debate",
          "source": "congress-amendments",
          "target": "whole-debate",
          "kind": "flow",
          "label": "Есть поправки к тексту в целом",
          "ref": "007"
        },
        {
          "id": "whole-debate>government-returned",
          "source": "whole-debate",
          "target": "government-returned",
          "kind": "flow",
          "label": "Допустимый возврат принят",
          "ref": "007"
        },
        {
          "id": "whole-debate>alternative-text",
          "source": "whole-debate",
          "target": "alternative-text",
          "kind": "flow",
          "label": "Альтернативный текст принят",
          "ref": "007"
        },
        {
          "id": "alternative-text>congress-amendments",
          "source": "alternative-text",
          "target": "congress-amendments",
          "kind": "return",
          "label": "Новый срок только к статьям",
          "ref": "007",
          "feedback": true
        },
        {
          "id": "whole-debate>congress-ponencia",
          "source": "whole-debate",
          "target": "congress-ponencia",
          "kind": "flow",
          "label": "Продолжение рассмотрения",
          "ref": "007"
        },
        {
          "id": "congress-ponencia>congress-commission",
          "source": "congress-ponencia",
          "target": "congress-commission",
          "kind": "flow",
          "ref": "007"
        },
        {
          "id": "congress-commission>approval",
          "source": "congress-commission",
          "target": "approval",
          "kind": "flow",
          "ref": "007"
        }
      ],
      "removeEdges": [
        "discussion-approval"
      ],
      "description": "Настоящие процедурные развилки и действия; сроки и формальные требования остаются в описании карточки."
    },
    "approval": {
      "nodes": [
        "congress-plenary",
        "congress-full-commission"
      ],
      "edges": [
        {
          "id": "approval>congress-plenary",
          "source": "approval",
          "target": "congress-plenary",
          "kind": "flow",
          "label": "Рассмотрение пленумом",
          "ref": "008"
        },
        {
          "id": "approval>congress-full-commission",
          "source": "approval",
          "target": "congress-full-commission",
          "kind": "flow",
          "label": "Обычный закон · при делегировании",
          "ref": "008",
          "mode": "ordinary"
        },
        {
          "id": "congress-plenary>senate",
          "source": "congress-plenary",
          "target": "senate",
          "kind": "flow",
          "label": "Текст одобрен",
          "ref": "008"
        },
        {
          "id": "congress-full-commission>senate",
          "source": "congress-full-commission",
          "target": "senate",
          "kind": "flow",
          "label": "Текст одобрен",
          "ref": "008",
          "mode": "ordinary"
        }
      ],
      "removeEdges": [
        "approval-senate"
      ],
      "description": "Орган, принимающий текст: пленум либо комиссия при допустимой полной компетенции. Для органического закона комиссия исключена."
    },
    "ilp-signatures": {
      "nodes": [
        "ilp-electors"
      ],
      "edges": [
        {
          "id": "ilp-signatures>ilp-electors",
          "source": "ilp-signatures",
          "target": "ilp-electors",
          "kind": "membership",
          "label": "Подписывают",
          "ref": "005",
          "mode": "ordinary"
        }
      ],
      "removeEdges": [],
      "description": "Граждане участвуют на этом этапе, подписывая предварительно допущенное предложение."
    }
  },
  "nodeModes": {
    "ilp-blocked": "organic",
    "congress-full-commission": "ordinary",
    "ilp-electors": "ordinary",
    "ilp-notice": "ordinary",
    "ilp-signatures": "ordinary",
    "ilp-check": "ordinary",
    "ilp-parliament": "ordinary",
    "ilp-refused": "ordinary",
    "congress-ordinary-type": "ordinary",
    "congress-organic-type": "organic"
  },
  "participantGroups": [
    {
      "stage": "ilp-signatures",
      "participant": "ilp-electors"
    }
  ]
};
