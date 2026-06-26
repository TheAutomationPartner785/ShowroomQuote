import { useState, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import BottomActionBar from './components/BottomActionBar';
import Step1 from './components/Step1';
import Step2 from './components/Step2';
import Step3 from './components/Step3';
import Step4 from './components/Step4';
import './theme-tokens.css';

const STEPS = ['Lead Selection', 'Add Products', 'Review', 'Confirm & Send'];

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);
  const [cart, setCart] = useState([]);
  const step4FinishRef = useRef(null);

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStep2Save = (newCart) => {
    setCart(newCart);
    setCurrentStep(3);
  };

  const handleStep3Advance = () => {
    setCurrentStep(4);
  };

  const handleStep4Finish = () => {
    setCurrentStep(1);
    setSelectedLead(null);
    setCart([]);
  };

  const handleNext = async () => {
    if (currentStep === 4) {
      if (step4FinishRef.current) {
        await step4FinishRef.current();
      } else {
        handleStep4Finish();
      }
      return;
    }

    if (currentStep === 1 && selectedLead) {
      setCurrentStep(2);
    } else if (currentStep === 2 && cart.length > 0) {
      setCurrentStep(3);
    } else if (currentStep === 3 && cart.length > 0) {
      setCurrentStep(4);
    }
  };

  return (
    <Box minH="100vh" bg="white" fontFamily="Inter, system-ui, sans-serif" pb={{ base: '64px', md: '72px' }}>
      <Header />
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {currentStep === 1 && (
        <Step1 selectedLead={selectedLead} setSelectedLead={setSelectedLead} onNext={handleNext} />
      )}
      {currentStep === 2 && (
        <Step2 selectedLeadId={selectedLead?.id} cart={cart} setCart={setCart} onPrevious={handlePrevious} onNext={handleStep2Save} />
      )}
      {currentStep === 3 && (
        <Step3 selectedLeadId={selectedLead?.id} cart={cart} onPrevious={handlePrevious} onNext={handleStep3Advance} />
      )}
      {currentStep === 4 && (
        <Step4
          selectedLeadId={selectedLead?.id}
          cart={cart}
          onBack={() => setCurrentStep(3)}
          onFinish={handleStep4Finish}
          handleFinishRef={step4FinishRef}
        />
      )}

      <BottomActionBar
        onCancel={() => { if (currentStep === 1) { setSelectedLead(null); } else if (currentStep === 4) { setCurrentStep(3); } else { setCurrentStep(1); } }}
        onPrevious={handlePrevious}
        onNext={handleNext}
        nextDisabled={currentStep === 1 ? !selectedLead : currentStep === 2 ? cart.length === 0 : currentStep === 3 ? cart.length === 0 : false}
        currentStep={currentStep}
      />
    </Box>
  );
}

export default App;
