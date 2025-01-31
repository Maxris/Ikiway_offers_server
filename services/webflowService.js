const axios = require('axios');
require('dotenv').config();
const Job = require('../models/jobOffer'); // ✅ Import du modèle MongoDB

const WEBFLOW_API_URL = 'https://api.webflow.com/v2/collections';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE_ID = process.env.WEBFLOW_SITE_ID; 
const COLLECTION_ID = process.env.COLLECTION_ID;

// ✅ Fonction pour récupérer l'ID de la collection Webflow
async function getWebflowCollectionId() {
    try {
        console.log(`🔎 Récupération des collections Webflow pour le site ID: ${SITE_ID}`);

        const response = await axios.get(`https://api.webflow.com/v2/sites/${SITE_ID}/collections`, {
            headers: {
                'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
                'accept-version': '2.0',
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Collections Webflow récupérées :", response.data);

        // 🔍 Recherche la collection "Jobs"
        const collection = response.data.collections.find(col => col.displayName === "Jobs");

        if (!collection) {
            throw new Error("❌ Collection Webflow 'Jobs' introuvable !");
        }

        console.log(`✅ Collection Webflow trouvée : ID ${collection.id}`);
        return collection.id;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération de l'ID de la collection Webflow :", error.response?.data || error.message);
        throw error;
    }
}




// ✅ Fonction pour publier automatiquement les offres après ajout
async function publishWebflowCollection() {
    console.log("🚀 Publication des offres Webflow...");

    try {
        const response = await axios.post(
            `https://api.webflow.com/v2/sites/${process.env.WEBFLOW_SITE_ID}/publish`,
            {
                collections: [process.env.WEBFLOW_COLLECTION_ID], // ✅ Utilisation de l'ID de la collection
                domains: [process.env.WEBFLOW_DOMAIN_ID] // ✅ Utilisation du domaine Webflow.io
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                    'accept-version': '2.0',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("✅ Offres publiées avec succès :", response.data);
    } catch (error) {
        console.error("❌ Erreur lors de la publication des offres Webflow :", error.response?.data || error.message);
    }
}




// ✅ Fonction pour récupérer toutes les offres existantes dans Webflow
async function getExistingWebflowJobs() {
    console.log("🔎 Vérification des offres déjà présentes dans Webflow...");

    try {
        const response = await axios.get(
            `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`,
            {
                headers: {
                    'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
                    'accept-version': '2.0'
                }
            }
        );

        // 🔥 Vérifier si on reçoit bien des données
        if (!response.data.items || response.data.items.length === 0) {
            console.log("⚠️ Aucune offre existante trouvée sur Webflow.");
            return new Set();
        }

        // ✅ Extraction des `reference-id` (ou `name` si besoin)
        const existingJobs = new Set(response.data.items.map(item => item["reference-id"]));

        console.log(`✅ ${existingJobs.size} offres déjà présentes dans Webflow.`);
        return existingJobs;

    } catch (error) {
        console.error("❌ Erreur lors de la récupération des offres Webflow :", error.response?.data || error.message);
        return new Set(); // 🔴 Retourne un Set vide en cas d'erreur pour éviter les bugs
    }
}




// ✅ Fonction pour envoyer toutes les offres existantes dans Webflow
exports.sendJobsToWebflow = async function () {
    console.log("⚡ Envoi des offres d'emploi vers Webflow...");

    try {
        // 🔎 Récupération de l'ID de la collection si non défini
        let collectionId = process.env.WEBFLOW_COLLECTION_ID;
        if (!collectionId) {
            console.log("🔍 ID de la collection Webflow non trouvé, récupération...");
            collectionId = await getWebflowCollectionId();
            process.env.WEBFLOW_COLLECTION_ID = collectionId; // ✅ Stocker pour éviter de le récupérer à chaque appel
        }

        console.log(`✅ Collection Webflow ID : ${collectionId}`);

        // 🔍 Récupération des offres existantes pour éviter les doublons
        const existingWebflowJobs = await getExistingWebflowJobs();

        // 📦 Récupération des offres MongoDB
        const jobs = await Job.find({});
        console.log(`📦 ${jobs.length} offres récupérées depuis MongoDB`);

        for (const job of jobs) {
            // 🔄 Vérifier si l'offre existe déjà sur Webflow
            if (existingWebflowJobs.has(job.offre_id)) {
                console.log(`🔄 Offre déjà existante, pas d'ajout : ${job.titre}`);
                continue; // ❌ On passe cette offre
            }

            try {
                const webflowJob = {
                    items: [
                        {
                            fieldData: {
                                "reference-id": job.offre_id,
                                "titre-du-poste": job.titre,
                                "name": job.titre,
                                "slug": job.titre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50),
                                "responsable": job.societe,
                                "email-du-reponsable": job.apply_mail,
                                "description-du-poste": job.desc_poste || "",
                                "aboutcompany": job.desc_societe || "",
                                "searchedprofile": job.desc_profil || "",
                                "localisation": job.ville || "",
                                "sector": job.metier || "",
                                "contracttype": job.contrat_lib || "",
                                "salary": `${job.sal_min || ''} - ${job.sal_max || ''}`,
                                "timeperweek": job.temps_travail || "",
                                "schedules": job.remote_type || "",
                                "project-id": job.apply_url
                            }
                        }
                    ]
                };

                console.log(`📤 Envoi de l'offre '${job.titre}' vers Webflow...`);

                const response = await axios.post(
                    `https://api.webflow.com/v2/collections/${collectionId}/items`,
                    webflowJob,
                    {
                        headers: {
                            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
                            'accept-version': '2.0',
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log(`✅ Offre envoyée avec succès : ${job.titre}`);

            } catch (err) {
                console.error(`❌ Erreur lors de l'ajout de '${job.titre}' :`, err.response?.data || err.message);
            }
        }

        console.log("🎯 Toutes les offres ont été traitées (sans doublon).");

        // 🚀 Publier la collection après ajout des offres
        await publishWebflowCollection();

    } catch (error) {
        console.error("❌ Erreur lors de l'envoi des offres à Webflow :", error.message);
    }
};
