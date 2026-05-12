import React from 'react';
import { Link } from 'react-router-dom';
import { Send, Ticket, Search, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Hero */}
      <section className="text-center pt-2 pb-2">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Technical Support Portal
        </h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-4">
          Report issues with your SBC, media gateway, or signaling equipment. Our AI-powered system
          analyzes your ticket and assigns the best support specialist based on expertise and availability.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/submit" className="inline-flex items-center px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm md:text-base font-medium hover:bg-primary-400 transition-colors">
            <Send className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Submit a Ticket
          </Link>
          <Link to="/my-tickets" className="inline-flex items-center px-5 py-2.5 bg-white dark:bg-tb-card text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-sm md:text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <Ticket className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            My Tickets
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-4 lg:gap-6">
        <div className="tb-card p-4 lg:p-5">
          <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-accent-blue" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">AI-Powered Analysis</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs lg:text-sm">
            Claude AI analyzes your ticket to classify the issue, determine severity, and hypothesize root causes.
          </p>
        </div>
        <div className="tb-card p-4 lg:p-5">
          <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-accent-green" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Smart Assignment</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs lg:text-sm">
            Automatically assigns the best support specialist based on skills, product expertise, workload, and availability.
          </p>
        </div>
        <div className="tb-card p-4 lg:p-5">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Real-Time Tracking</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs lg:text-sm">
            Track your ticket status in real-time with your ticket number. No account required.
          </p>
        </div>
      </section>

      {/* Products */}
      <section>
        <h2 className="text-lg lg:text-xl font-bold text-center text-gray-900 dark:text-white mb-3 lg:mb-4">Supported Products</h2>
        <div className="grid md:grid-cols-3 gap-3 lg:gap-4 max-w-5xl mx-auto">
          <div className="tb-card p-3 lg:p-4">
            <div className="h-10 mb-2 flex items-center">
              <img src="/images/prosbc.png" alt="ProSBC" className="max-h-10 object-contain" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">ProSBC</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">Carrier-grade Session Border Controller for SIP trunking, peering, and security.</p>
          </div>
          <div className="tb-card p-3 lg:p-4">
            <div className="h-10 mb-2 flex items-center">
              <img src="/images/tmg800-3200.png" alt="Tmedia Gateways" className="max-h-10 object-contain" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Tmedia Gateways</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">TMG800, TMG3200, TMG7800 VoIP/SS7 media gateways for TDM-to-IP migration.</p>
          </div>
          <div className="tb-card p-3 lg:p-4">
            <div className="h-10 mb-2 flex items-center">
              <img src="/images/tmg800-3200.png" alt="Tsig Gateways" className="max-h-10 object-contain" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Tsig Gateways</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">TSG800, TSG3200 SS7/SIGTRAN signaling gateways with 99.999% availability.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
