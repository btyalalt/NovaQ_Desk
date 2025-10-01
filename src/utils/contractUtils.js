// Contract status utility functions
export const getContractStatus = (daysLeft) => {
  if (daysLeft <= 0) {
    return {
      className: 'contract-expired',
      message: 'Гэрээ дууссан'
    };
  } else if (daysLeft <= 5) {
    return {
      className: 'contract-warning',
      message: `Гэрээ ${daysLeft} хоногийн дараа дуусна`
    };
  } else if (daysLeft <= 30) {
    return {
      className: 'contract-notice',
      message: `Гэрээ ${daysLeft} хоногийн дараа дуусна`
    };
  } else {
    return {
      className: 'contract-active',
      message: `Гэрээ ${daysLeft} хоногийн дараа дуусна`
    };
  }
};

// Contract validation
export const isContractActive = (daysLeft) => {
  return daysLeft > 0;
};

export const isContractExpiringSoon = (daysLeft) => {
  return daysLeft <= 30 && daysLeft > 0;
};

export const isContractExpired = (daysLeft) => {
  return daysLeft <= 0;
};

// Contract info formatter
export const formatContractInfo = (contractInfo) => {
  if (!contractInfo) return null;
  
  return {
    daysLeft: contractInfo.daysLeft || 0,
    status: getContractStatus(contractInfo.daysLeft || 0),
    isActive: isContractActive(contractInfo.daysLeft || 0),
    isExpiringSoon: isContractExpiringSoon(contractInfo.daysLeft || 0),
    isExpired: isContractExpired(contractInfo.daysLeft || 0)
  };
};
