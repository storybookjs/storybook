export const Html = ({ content }) => {
  const contentValue = typeof content === 'function' ? content() : content;
  return <div dangerouslySetInnerHTML={{ __html: contentValue }} />;
};
