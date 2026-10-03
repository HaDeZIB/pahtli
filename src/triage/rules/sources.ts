/** URLs de las fuentes primarias consultadas (descargadas y leídas al construir las reglas, oct-2026). */
export const SRC = {
  IMCI_2014: 'https://cdn.who.int/media/docs/default-source/mca-documents/child/imci-integrated-management-of-childhood-illness/imci-in-service-training/imci-chart-booklet.pdf',
  IMCI_YI_2019: 'https://iris.who.int/server/api/core/bitstreams/e5a2ace4-c5ae-462d-b28c-1ac1d1a351ca/content',
  ICCM: 'https://www.childhealthtaskforce.org/sites/default/files/2019-06/Caring%20for%20Sick%20Child%20in%20the%20Community%20CHW%20Chart%20Booklet%28WHO%2CUNICEF%2C2014%29.pdf',
  NOM_031: 'https://hist.cndh.org.mx/sites/default/files/doc/Programas/VIH/Leyes%20y%20normas%20y%20reglamentos/Norma%20Oficial%20Mexicana/NOM-031-SSA2-1999%20Salud%20del%20ni%C3%B1o.pdf',
  NOM_007: 'https://www.gob.mx/cms/uploads/attachment/file/512098/NOM-007-SSA2-2016.pdf',
  IMSS_GPC_PRENATAL: 'https://www.imss.gob.mx/sites/all/statics/guiasclinicas/028GRR.pdf',
  WHO_PCPNC_2015: 'https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content',
  PAHO_DENGUE_2020: 'https://www.paho.org/sites/default/files/2020-09/2020-cde-algoritmos-manejo-clinico-dengue.pdf',
  IITT_ADULT: 'https://cdn.who.int/media/docs/default-source/integrated-health-services-(ihs)/csy/iitt/iitt_adult.pdf?sfvrsn=b2a91431_1',
  IITT_PED: 'https://cdn.who.int/media/docs/default-source/integrated-health-services-(ihs)/csy/iitt/iitt_pediatric.pdf?sfvrsn=15161bfb_1',
  CDC_STROKE: 'https://www.cdc.gov/stroke/signs-symptoms/index.html',
  CDC_HEART_ATTACK: 'https://www.cdc.gov/heart-disease/about/heart-attack.html',
  NICE_NG143: 'https://www.nice.org.uk/guidance/ng143',
  WHO_DIARRHOEA_2005: 'https://iris.who.int/server/api/core/bitstreams/df59ceab-2498-4a64-bd93-ad7566addb4e/content',
  WHO_MHGAP_2016: 'https://iris.who.int/server/api/core/bitstreams/6ded7ffd-9d69-493a-b48a-0b3e6250c173/content',
  IMSS_SARAMPION: 'https://www.imss.gob.mx/sites/all/statics/salud/infografiasl/Sarampion-personal-institucional.pdf',
} as const;

/** Cita corta reutilizable (el detalle de página/sección va en cada regla). */
export const CITE = {
  IMCI_2014: 'OMS/UNICEF, AIEPI (IMCI) Chart Booklet, 2014',
  IMCI_YI_2019: 'OMS, AIEPI: manejo del lactante enfermo de hasta 2 meses, Chart Booklet 2019',
  ICCM: 'OMS/UNICEF, Caring for the sick child in the community (AIEPI comunitario), Chart Booklet 2014',
  NOM_031: 'NOM-031-SSA2-1999, Para la atención a la salud del niño (DOF 09-02-2001)',
  NOM_007: 'NOM-007-SSA2-2016, Atención de la mujer durante el embarazo, parto y puerperio (DOF 07-04-2016)',
  IMSS_GPC_PRENATAL: 'GPC IMSS-028-08 Control prenatal con atención centrada en la paciente, GRR act. 2017',
  WHO_PCPNC_2015: 'OMS, Pregnancy, Childbirth, Postpartum and Newborn Care (PCPNC), 3a ed. 2015',
  PAHO_DENGUE_2020: 'OPS, Algoritmos para el manejo clínico de los casos de dengue, 2020 (basado en Guía OPS 2016)',
  IITT: 'OMS/CICR/MSF, Interagency Integrated Triage Tool (IITT)',
  CDC_STROKE: 'CDC, Signs and Symptoms of Stroke',
  CDC_HEART_ATTACK: 'CDC, About Heart Attack Symptoms, Risk, and Recovery',
  NICE_NG143: 'NICE NG143, Fever in under 5s: assessment and initial management (2019, act. 2021)',
  WHO_DIARRHOEA_2005: 'OMS, The treatment of diarrhoea: a manual for physicians and other senior health workers, 4a rev. 2005',
  WHO_MHGAP_2016: 'OMS, mhGAP Intervention Guide 2.0, 2016',
  IMSS_SARAMPION: 'IMSS, Sarampión: información para personal institucional (infografía, consultada oct-2026)',
} as const;
