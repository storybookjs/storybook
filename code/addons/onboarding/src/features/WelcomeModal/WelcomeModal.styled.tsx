import { ArrowRightIcon } from '@storybook/icons';
import { keyframes, styled } from '@storybook/theming';
import { Modal } from '@storybook/components';

export const ModalWrapper = styled(Modal)`
  background: white;
`;

export const ModalContentWrapper = styled.div`
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: space-between;
`;

export const TopContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export const Title = styled.h1`
  margin: 0;
  margin-top: 20px;
  margin-bottom: 5px;
  color: ${({ theme }) => theme.color.darkest};
  font-weight: ${({ theme }) => theme.typography.weight.bold};
  font-size: ${({ theme }) => theme.typography.size.m1}px;
  line-height: ${({ theme }) => theme.typography.size.m3}px;
`;

export const Description = styled.p`
  margin: 0;
  margin-bottom: 20px;
  max-width: 320px;
  text-align: center;
  font-size: ${({ theme }) => theme.typography.size.s2}px;
  font-weight: ${({ theme }) => theme.typography.weight.regular};
  line-height: ${({ theme }) => theme.typography.size.m1}px;
  color: ${({ theme }) => theme.color.darker};
`;

export const SkipButton = styled.button`
  all: unset;
  cursor: pointer;
  font-size: 13px;
  color: #798186;
  padding-bottom: 20px;

  &:focus-visible {
    outline: auto;
  }
`;

export const StyledIcon = styled(ArrowRightIcon)`
  margin-left: 2px;
  height: 10px;
`;

export const Background = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
`;

export const circle1Anim = keyframes`
  0% { transform: translate(0px, 0px) }
  50% { transform: translate(-200px, 0px) }
  100% { transform: translate(0px, 0px) }
`;

export const Circle1 = styled.div`
  position: absolute;
  width: 1200px;
  height: 1200px;
  left: -200px;
  top: -900px;
  background: radial-gradient(
    circle at center,
    rgba(253, 255, 147, 1) 0%,
    rgba(253, 255, 147, 0) 70%
  );
  animation: ${circle1Anim} 4s linear infinite;
  animation-timing-function: ease-in-out;
  z-index: 3;
`;

export const circle2Anim = keyframes`
  0% { transform: translate(0px, 0px) }
  50% { transform: translate(400px, 0px) }
  100% { transform: translate(0px, 0px) }
`;

export const Circle2 = styled.div`
  position: absolute;
  width: 1200px;
  height: 1200px;
  left: -600px;
  top: -840px;
  background: radial-gradient(
    circle at center,
    rgba(255, 119, 119, 1) 0%,
    rgba(255, 119, 119, 0) 70%
  );
  animation: ${circle2Anim} 6s linear infinite;
  animation-timing-function: ease-in-out;
  z-index: 2;
`;

export const circle3Anim = keyframes`
  0% { transform: translate(600px, -40px) }
  50% { transform: translate(600px, -200px) }
  100% { transform: translate(600px, -40px) }
`;

export const Circle3 = styled.div`
  position: absolute;
  width: 1200px;
  height: 1200px;
  left: -600px;
  top: -840px;
  background: radial-gradient(
    circle at center,
    rgba(119, 255, 247, 0.8) 0%,
    rgba(119, 255, 247, 0) 70%
  );
  animation: ${circle3Anim} 4s linear infinite;
  animation-timing-function: ease-in-out;
  z-index: 4;
`;

export const StyledTitle = styled.h2`
  color: #000;
  font-weight: 700;
  font-size: 20px;
  line-height: 20px;
`;
export const StyledDescription = styled.p`
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: #454e54;
`;
