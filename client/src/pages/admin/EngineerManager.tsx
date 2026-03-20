import React, { useEffect, useState } from 'react';
import { engineers as engineersApi } from '../../api/client';
import { User, Star, ChevronDown, ChevronUp } from 'lucide-react';

export default function EngineerManager() {
  const [engineers, setEngineers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      engineersApi.list(),
      engineersApi.skills(),
    ]).then(([e, s]) => {
      setEngineers(e);
      setSkills(s);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    const d = await engineersApi.get(id);
    setDetail(d);
  };

  const updateSkill = async (engineerId: number, skillId: number, proficiency: number) => {
    if (!detail) return;
    const currentSkills = detail.skills.map((s: any) => ({
      skillId: s.id,
      proficiency: s.id === skillId ? proficiency : s.proficiency,
    }));
    // Add new skill if not present
    if (!currentSkills.find((s: any) => s.skillId === skillId)) {
      currentSkills.push({ skillId, proficiency });
    }
    await engineersApi.updateSkills(engineerId, currentSkills);
    const d = await engineersApi.get(engineerId);
    setDetail(d);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading engineers...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Engineer Management</h1>

      <div className="space-y-3">
        {engineers.map(eng => (
          <div key={eng.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button onClick={() => toggleExpand(eng.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{eng.name}</p>
                  <p className="text-sm text-gray-500">{eng.email} - {eng.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">Workload: {eng.currentWorkload}/{eng.maxWorkload}</p>
                  <div className="w-24 bg-gray-100 rounded-full h-2 mt-1">
                    <div className={`h-2 rounded-full ${eng.currentWorkload / eng.maxWorkload > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${(eng.currentWorkload / eng.maxWorkload) * 100}%` }} />
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eng.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {eng.isActive ? 'Active' : 'Inactive'}
                </span>
                {expanded === eng.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            {expanded === eng.id && detail && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Skills */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Skills</h4>
                    <div className="space-y-2">
                      {skills.map((skill: any) => {
                        const engineerSkill = detail.skills?.find((s: any) => s.id === skill.id);
                        const proficiency = engineerSkill?.proficiency || 0;
                        return (
                          <div key={skill.id} className="flex items-center justify-between">
                            <span className="text-sm">{skill.name}</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button key={level}
                                  onClick={() => updateSkill(eng.id, skill.id, level)}
                                  className="p-0.5">
                                  <Star className={`w-4 h-4 ${level <= proficiency ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Product Expertise */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Product Expertise</h4>
                    <div className="space-y-2">
                      {(detail.expertise || []).map((exp: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{exp.productName} / {exp.categoryName || 'General'}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(level => (
                              <Star key={level}
                                className={`w-4 h-4 ${level <= exp.expertiseLevel ? 'fill-blue-400 text-blue-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
