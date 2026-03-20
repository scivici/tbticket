import React from 'react';
import { Link } from 'react-router-dom';
import { Send, Search, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          TelcoBridges Support
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Report issues with your SBC, media gateway, or signaling equipment. Our AI-powered system
          analyzes your ticket and assigns the best engineer based on expertise and availability.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/submit" className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
            <Send className="w-5 h-5 mr-2" />
            Submit a Ticket
          </Link>
          <Link to="/track" className="inline-flex items-center px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            <Search className="w-5 h-5 mr-2" />
            Track a Ticket
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
          <p className="text-gray-600 text-sm">
            Claude AI analyzes your ticket to classify the issue, determine severity, and hypothesize root causes.
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Smart Assignment</h3>
          <p className="text-gray-600 text-sm">
            Automatically assigns the best engineer based on skills, product expertise, workload, and availability.
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Real-Time Tracking</h3>
          <p className="text-gray-600 text-sm">
            Track your ticket status in real-time with your ticket number. No account required.
          </p>
        </div>
      </section>

      {/* Products */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-8">Supported Products</h2>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">📡</div>
            <h3 className="text-base font-semibold mb-1">ProSBC / FreeSBC</h3>
            <p className="text-gray-600 text-xs">Carrier-grade Session Border Controllers for SIP trunking, peering, and security.</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">🔌</div>
            <h3 className="text-base font-semibold mb-1">Tmedia Gateways</h3>
            <p className="text-gray-600 text-xs">TMG800, TMG3200, TMG7800 VoIP/SS7 media gateways for TDM-to-IP migration.</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">🔗</div>
            <h3 className="text-base font-semibold mb-1">Tsig Gateways</h3>
            <p className="text-gray-600 text-xs">TSG800, TSG3200 SS7/SIGTRAN signaling gateways with 99.999% availability.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
