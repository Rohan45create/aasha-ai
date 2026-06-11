// TODO: Add view mode — same pattern as FamilySurvey.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import EmptyState from '../../../components/EmptyState';
import BaseModuleForm from '../../../components/BaseModuleForm';
import AadhaarLinkagePopup from '../../../components/AadhaarLinkagePopup';
import { apiFetch } from '../../../utils/api';

export default function DynamicSurvey() {
  const [searchParams] = useSearchParams();
  const surveyId = searchParams.get('id');
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showLinkagePopup, setShowLinkagePopup] = useState(false);
  const [linkageData, setLinkageData] = useState(null);
  const [linkageConfirmedData, setLinkageConfirmedData] = useState(null);

  useEffect(() => {
    if (!surveyId) {
      setLoading(false);
      return;
    }
    const fetchTemplate = async () => {
      try {
        const snap = await getDoc(doc(db, 'survey_templates', surveyId));
        if (snap.exists()) {
          setTemplate({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [surveyId]);

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-[#F3E5F5] rounded-full flex items-center justify-center text-[#6A1B9A]">
              <span className="material-symbols-outlined text-2xl">assignment</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1A1A18]">Dynamic Surveys</h2>
              <p className="text-xs text-[#5F5E5A]">Custom surveys published by your supervisor</p>
            </div>
          </div>
        </div>
        <EmptyState module="default" message="No surveys assigned yet. Your supervisor will publish surveys that will appear here automatically." />
      </div>
    );
  }

  const handleAadhaarEntered = async (last4) => {
    if (template.hasLinkage && template.linkMethod === 'aadhaar') {
      try {
        const result = await apiFetch('/api/members/check-linkage', {
          method: 'POST',
          body: JSON.stringify({ aadhaar_last4: last4, module_type: template.connectedSurvey })
        });
        if (result.match_found) {
          setLinkageData(result);
          setShowLinkagePopup(true);
        }
      } catch (err) {
        console.log('Linkage check skipped', err);
      }
    }
  };

  const handleAfterSubmit = async (docId) => {
    if (linkageConfirmedData && template.hasLinkage) {
      const collMap = {
        'family_survey': 'household_members',
        'child_growth': 'children',
        'anc': 'pregnancies',
        'vaccination': 'vaccinations',
        'village_health': 'village_health'
      };
      
      try {
        await apiFetch('/api/members/confirm-linkage', {
          method: 'POST',
          body: JSON.stringify({
            record_collection: collMap[template.connectedSurvey] || template.connectedSurvey,
            record_id: docId,
            household_id: linkageConfirmedData.household_id,
            member_id: linkageConfirmedData.member_id
          })
        });
      } catch (err) {
        console.error('Linkage confirmation failed', err);
      }
    }
  };

  const formFields = template.fields.map(f => ({
    id: f.id.toString(),
    label: f.label_en,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder_en,
    options: f.type === 'select' && f.options_en ? f.options_en.split(',').map(o => ({ value: o.trim(), label: o.trim() })) : undefined
  }));

  const hasAadhaarField = template.fields.some(f => f.type === 'aadhaar');

  return (
    <>
      <BaseModuleForm 
        title={template.title}
        moduleIcon="assignment" 
        collectionName="dynamic_submissions"
        moduleName="dynamic"
        fields={formFields}
        showAadhaar={hasAadhaarField}
        aadhaarPersonLabel="Participant"
        onAadhaarScanned={handleAadhaarEntered}
        afterSubmit={handleAfterSubmit}
        extraData={{ templateId: template.id }}
      />
      <AadhaarLinkagePopup
        isOpen={showLinkagePopup}
        memberName={linkageData?.member_name}
        familyHeadName={linkageData?.family_head}
        moduleType={template.connectedSurvey}
        onConfirm={() => { setShowLinkagePopup(false); setLinkageConfirmedData(linkageData); }}
        onReject={() => { setShowLinkagePopup(false); setLinkageConfirmedData(null); }}
        onClose={() => { setShowLinkagePopup(false); setLinkageConfirmedData(null); }}
      />
    </>
  );
}

